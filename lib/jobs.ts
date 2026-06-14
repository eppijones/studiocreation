import { put } from "@vercel/blob";
import { sql, type JobRow } from "./db";
import { scoreAssets } from "./score";

interface MediaFile {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** Pull media out of a fal result payload — images[], single image (upscalers), or video. */
function extractMedia(payload: Record<string, unknown>): MediaFile[] {
  const media: MediaFile[] = [];
  const images = payload.images as MediaFile[] | undefined;
  if (Array.isArray(images)) media.push(...images.filter((i) => i?.url));
  const image = payload.image as MediaFile | undefined;
  if (image?.url) media.push(image);
  const video = payload.video as MediaFile | undefined;
  if (video?.url) media.push({ ...video, duration: (payload.duration as number) ?? video.duration });
  return media;
}

function extFromContentType(ct: string | undefined, url: string): string {
  if (ct?.includes("png")) return "png";
  if (ct?.includes("jpeg") || ct?.includes("jpg")) return "jpg";
  if (ct?.includes("webp")) return "webp";
  if (ct?.includes("mp4")) return "mp4";
  if (ct?.includes("webm")) return "webm";
  const urlExt = url.split("?")[0].split(".").pop() ?? "";
  return ["png", "jpg", "jpeg", "webp", "mp4", "webm", "mov"].includes(urlExt) ? urlExt : "bin";
}

/**
 * Marks the job done, mirrors media into Blob, inserts asset rows.
 *
 * Claim-atomic: the webhook and any number of concurrent pollers may call this
 * for the same job. A single `finalizing_at` claim guarantees exactly one
 * finalizer; stale claims (>2 min, e.g. a crashed finalizer) are reclaimable.
 */
export async function completeJob(job: JobRow, payload: Record<string, unknown>): Promise<void> {
  if (job.status === "done" || job.status === "error" || job.status === "canceled") return;

  const claim = await sql`
    UPDATE jobs SET finalizing_at = now()
    WHERE id = ${job.id}
      AND status NOT IN ('done', 'error', 'canceled')
      AND (finalizing_at IS NULL OR finalizing_at < now() - interval '2 minutes')
    RETURNING id
  `;
  if (claim.length === 0) return; // another worker (or the webhook) owns this job

  try {
    const media = extractMedia(payload);
    const date = new Date().toISOString().slice(0, 10);
    const assetIds: number[] = [];

    // Idempotency: a prior attempt (or the webhook) may have already mirrored
    // some of these. Skip URLs we've already stored so retries never duplicate.
    const existing = (await sql`
      SELECT source_url FROM assets WHERE job_id = ${job.id} AND source_url IS NOT NULL
    `) as { source_url: string }[];
    const stored = new Set(existing.map((r) => r.source_url));
    let present = stored.size; // how many of this job's media are already on disk

    for (let i = 0; i < media.length; i++) {
      const file = media[i];
      if (stored.has(file.url)) {
        continue; // already mirrored on an earlier attempt
      }
      try {
        const res = await fetch(file.url);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = file.content_type ?? res.headers.get("content-type") ?? undefined;
        const ext = extFromContentType(contentType, file.url);
        const suffix = media.length > 1 ? `-${i + 1}` : "";
        const path = `${job.project}/${date}/${job.request_id}_${job.label}${suffix}.${ext}`;

        const blob = await put(path, buffer, {
          access: "public",
          contentType,
          addRandomSuffix: false,
        });

        const inserted = await sql`
          INSERT INTO assets (job_id, blob_url, source_url, content_type, width, height, duration_s)
          VALUES (${job.id}, ${blob.url}, ${file.url}, ${contentType ?? null},
                  ${file.width ?? null}, ${file.height ?? null}, ${file.duration ?? null})
          RETURNING id
        `;
        assetIds.push(inserted[0].id as number);
        present++;
      } catch (e) {
        // One flaky media URL must not strand the whole job. Log and press on;
        // the job still completes as long as at least one render landed.
        console.error(`completeJob: skipped media for job ${job.id}: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Nothing landed at all → likely a transient (expired URLs / network).
    // Release the claim and let the next poll retry rather than mark an empty done.
    if (present === 0 && media.length > 0) {
      throw new Error(`no media could be mirrored for job ${job.id}`);
    }

    await sql`
      UPDATE jobs SET status = 'done', completed_at = now() WHERE id = ${job.id}
    `;

    // Auto quality/fidelity score (opt-in). Best-effort: never blocks delivery.
    if (assetIds.length) void scoreAssets(job, assetIds);
  } catch (err) {
    // Release the claim so the webhook / a later poll can retry this job.
    await sql`
      UPDATE jobs SET finalizing_at = NULL WHERE id = ${job.id} AND status NOT IN ('done', 'error', 'canceled')
    `;
    throw err;
  }
}

export async function failJob(jobId: number, error: string): Promise<void> {
  await sql`
    UPDATE jobs SET status = 'error', error = ${error.slice(0, 1000)}, completed_at = now()
    WHERE id = ${jobId} AND status NOT IN ('done', 'error', 'canceled')
  `;
}

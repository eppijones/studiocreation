import { put } from "@vercel/blob";
import { sql, type JobRow } from "./db";

interface MediaFile {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** Pull media out of a fal result payload — image models return images[], video models return video. */
function extractMedia(payload: Record<string, unknown>): MediaFile[] {
  const media: MediaFile[] = [];
  const images = payload.images as MediaFile[] | undefined;
  if (Array.isArray(images)) media.push(...images.filter((i) => i?.url));
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

/** Idempotent: marks the job done, mirrors media into Blob, inserts asset rows. */
export async function completeJob(job: JobRow, payload: Record<string, unknown>): Promise<void> {
  if (job.status === "done" || job.status === "error") return;

  const media = extractMedia(payload);
  const date = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < media.length; i++) {
    const file = media[i];
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`Failed to download ${file.url}: ${res.status}`);
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

    await sql`
      INSERT INTO assets (job_id, blob_url, source_url, content_type, width, height, duration_s)
      VALUES (${job.id}, ${blob.url}, ${file.url}, ${contentType ?? null},
              ${file.width ?? null}, ${file.height ?? null}, ${file.duration ?? null})
    `;
  }

  await sql`
    UPDATE jobs SET status = 'done', completed_at = now() WHERE id = ${job.id}
  `;
}

export async function failJob(jobId: number, error: string): Promise<void> {
  await sql`
    UPDATE jobs SET status = 'error', error = ${error.slice(0, 1000)}, completed_at = now()
    WHERE id = ${jobId} AND status NOT IN ('done', 'error')
  `;
}

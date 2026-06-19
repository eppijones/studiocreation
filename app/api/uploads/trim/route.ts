import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { spawn } from "node:child_process";
import { writeFile, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "@/lib/db";
import { OPERATOR_COOKIE } from "@/lib/auth";
import { getModel, REF_MEDIA_DEFAULTS, type RefMedia } from "@/lib/pricing";

// Server-side trim: cut a sub-section of an over-limit video to a fitting clip via
// local ffmpeg, then register it as a $0 reference exactly like a plain upload. If
// ffmpeg isn't on the host (e.g. Vercel serverless) we answer 501 ffmpeg_unavailable
// so the client falls back to the in-browser trimmer. Node runtime (child_process).
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 256 * 1024 * 1024;

function slugify(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "clip"
  );
}

function inExt(contentType: string, name: string): string {
  const fromName = name.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  return "mp4";
}

class FfmpegMissingError extends Error {}

/** Cut [start, start+duration] and re-encode to a faststart H.264/AAC mp4 — an
 *  exact cut that plays everywhere. Rejects with FfmpegMissingError if the binary
 *  can't be spawned. */
async function ffmpegTrim(input: Buffer, ext: string, start: number, duration: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "sc-trim-"));
  const inPath = join(dir, `in.${ext}`);
  const outPath = join(dir, "out.mp4");
  try {
    await writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", [
        "-y",
        "-ss", start.toFixed(3),
        "-i", inPath,
        "-t", duration.toFixed(3),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-movflags", "+faststart",
        outPath,
      ]);
      let err = "";
      ff.stderr.on("data", (d) => {
        err += d.toString();
      });
      ff.on("error", (e: NodeJS.ErrnoException) =>
        reject(e.code === "ENOENT" ? new FfmpegMissingError() : e)
      );
      ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const contentType = file.type || "video/mp4";
  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: "Trim only applies to video files" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` }, { status: 413 });
  }

  const start = Math.max(0, Number(form.get("start")) || 0);
  const duration = Number(form.get("duration")) || 0;
  if (!(duration > 0)) {
    return NextResponse.json({ error: "A positive duration is required" }, { status: 400 });
  }

  const model = form.get("model")?.toString() ?? "";
  const limits: RefMedia = getModel(model)?.refMedia ?? REF_MEDIA_DEFAULTS;
  // Never let a trim land over the model's reference window.
  const dur = Math.min(duration, limits.maxVideoSec);

  const buffer = Buffer.from(await file.arrayBuffer());

  let trimmed: Buffer;
  try {
    trimmed = await ffmpegTrim(buffer, inExt(contentType, file.name || ""), start, dur);
  } catch (err) {
    if (err instanceof FfmpegMissingError) {
      // Signal the client to fall back to the in-browser trimmer.
      return NextResponse.json({ error: "ffmpeg_unavailable" }, { status: 501 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Trim failed" }, { status: 500 });
  }

  const cap = Math.min(limits.maxVideoMB * 1024 * 1024, MAX_BYTES);
  if (trimmed.byteLength > cap) {
    return NextResponse.json(
      { error: `Trimmed clip is still ${Math.round(trimmed.byteLength / 1024 / 1024)}MB — shorten the selection (max ${limits.maxVideoMB}MB)` },
      { status: 413 }
    );
  }

  const project = (form.get("project")?.toString() ?? "uploads").trim() || "uploads";
  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const date = new Date().toISOString().slice(0, 10);
  const slug = `${slugify(file.name || "clip")}-trim`;
  const path = `uploads/${date}/${Date.now()}_${slug}.mp4`;

  const blob = await put(path, trimmed, { access: "public", contentType: "video/mp4", addRandomSuffix: false });

  const jobRows = await sql`
    INSERT INTO jobs (provider, model, prompt, params, status, est_usd, actual_usd, operator, project, label, completed_at)
    VALUES ('upload', 'upload/trim', ${`Trimmed ${file.name || slug} (${dur.toFixed(1)}s)`}, '{}'::jsonb, 'done',
            0, 0, ${operator}, ${project}, ${slug}, now())
    RETURNING id
  `;
  const jobId = jobRows[0].id as number;

  const assetRows = await sql`
    INSERT INTO assets (job_id, blob_url, source_url, content_type)
    VALUES (${jobId}, ${blob.url}, ${blob.url}, 'video/mp4')
    RETURNING id, job_id, blob_url, content_type, status
  `;

  return NextResponse.json({ assets: [{ ...assetRows[0], project, label: slug }] });
}

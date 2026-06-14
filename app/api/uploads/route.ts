import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { OPERATOR_COOKIE } from "@/lib/auth";
import { getModel, REF_MEDIA_DEFAULTS, type RefMedia } from "@/lib/pricing";

export const maxDuration = 60;

// Reference uploads: image/video/audio files brought in from the operator's
// machine. They land in Blob and register as 'done' upload jobs + asset rows,
// so they show up in the gallery and the composer's reference picker like any
// render — but at $0, never touching the budget. Per-type size caps come from
// the target model's refMedia; an absolute ceiling guards the function itself.
const MAX_BYTES = 256 * 1024 * 1024; // hard ceiling per file
const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];

function mediaKind(contentType: string): "image" | "video" | "audio" | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return null;
}

function maxBytesFor(kind: "image" | "video" | "audio", limits: RefMedia): number {
  const mb = kind === "video" ? limits.maxVideoMB : kind === "audio" ? limits.maxAudioMB : limits.maxImageMB;
  return Math.min(mb * 1024 * 1024, MAX_BYTES);
}

function extFor(contentType: string, name: string): string {
  const fromName = name.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("aac")) return "aac";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("flac")) return "flac";
  return "bin";
}

function slugify(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "upload"
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  if (single instanceof File) files.push(single);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const project = (form.get("project")?.toString() ?? "uploads").trim() || "uploads";
  // Size caps follow the model the operator is uploading references for.
  const model = form.get("model")?.toString() ?? "";
  const limits: RefMedia = getModel(model)?.refMedia ?? REF_MEDIA_DEFAULTS;
  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const date = new Date().toISOString().slice(0, 10);

  const created: unknown[] = [];

  for (const file of files) {
    const contentType = file.type || "application/octet-stream";
    const kind = mediaKind(contentType);
    if (!kind || !ALLOWED_PREFIXES.some((p) => contentType.startsWith(p))) {
      return NextResponse.json({ error: `Unsupported file type: ${contentType}` }, { status: 415 });
    }
    const cap = maxBytesFor(kind, limits);
    if (file.size > cap) {
      return NextResponse.json(
        { error: `${file.name || kind} is too large (max ${Math.round(cap / 1024 / 1024)}MB for ${kind} references)` },
        { status: 413 }
      );
    }

    const slug = slugify(file.name || "upload");
    const ext = extFor(contentType, file.name || "");
    const path = `uploads/${date}/${Date.now()}_${slug}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const blob = await put(path, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    // Synthetic 'done' job keeps the assets→jobs JOIN, project reassignment and
    // PATCH lifecycle working with no schema change. $0, provider 'upload'.
    const jobRows = await sql`
      INSERT INTO jobs (provider, model, prompt, params, status, est_usd, actual_usd, operator, project, label, completed_at)
      VALUES ('upload', 'upload/file', ${`Uploaded ${file.name || slug}`}, '{}'::jsonb, 'done',
              0, 0, ${operator}, ${project}, ${slug}, now())
      RETURNING id
    `;
    const jobId = jobRows[0].id as number;

    const assetRows = await sql`
      INSERT INTO assets (job_id, blob_url, source_url, content_type)
      VALUES (${jobId}, ${blob.url}, ${blob.url}, ${contentType})
      RETURNING id, job_id, blob_url, content_type, status
    `;
    created.push({ ...assetRows[0], project, label: slug });
  }

  return NextResponse.json({ assets: created });
}

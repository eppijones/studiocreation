/**
 * Upload files into the writable local volume. Each lands on disk under the
 * chosen folder, then is indexed → fires the ingest automation (proxy +
 * transcribe). Multipart form-data: files[] + destFolder + volumeId.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { uploadFiles } from "@/studiolibrary/lib/fileops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow large bodies (footage can be big); Node runtime streams to memory here.
export const maxDuration = 300;

export async function POST(req: Request) {
  const actor = (await cookies()).get("studio_operator")?.value ?? null;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form-data" }, { status: 400 });
  }
  const volumeId = Number(form.get("volumeId"));
  const destFolder = String(form.get("destFolder") ?? "");
  const fileFields = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!fileFields.length) return NextResponse.json({ error: "no files" }, { status: 400 });

  try {
    const files = await Promise.all(
      fileFields.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))
    );
    return NextResponse.json(await uploadFiles(volumeId, destFolder, files, actor));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

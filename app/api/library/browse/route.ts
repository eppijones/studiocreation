/** File-explorer browse: immediate folders + files of a path on a volume. */
import { NextResponse } from "next/server";
import { browseFolder } from "@/studiolibrary/lib/browse";
import { listVolumes } from "@/studiolibrary/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const path = u.searchParams.get("path") ?? "";
  let volumeId = Number(u.searchParams.get("volumeId"));
  try {
    if (!volumeId) {
      const vols = await listVolumes();
      if (!vols.length) return NextResponse.json({ error: "no volumes" }, { status: 200 });
      volumeId = vols[0].id;
    }
    return NextResponse.json(await browseFolder(volumeId, path));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}

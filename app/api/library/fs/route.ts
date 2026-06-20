/**
 * File-management operations on the writable local volume: move (drag-drop),
 * rename, copy, new folder, delete (soft → recycle bin). Gated server-side on
 * volume writability; the on-prem archive can never reach these code paths.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  movePath, moveAssetToFolder, renamePath, copyPath, makeFolder, deleteAsset, trashFolder,
} from "@/studiolibrary/lib/fileops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const actor = (await cookies()).get("studio_operator")?.value ?? null;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const op = String(body.op ?? "");
  const num = (k: string) => Number(body[k]);
  const str = (k: string) => (body[k] == null ? "" : String(body[k]));

  try {
    switch (op) {
      case "moveAsset":
        return NextResponse.json(await moveAssetToFolder(num("assetId"), str("destFolder"), actor));
      case "move":
        return NextResponse.json(await movePath(num("volumeId"), str("src"), str("dest"), actor));
      case "rename":
        return NextResponse.json(await renamePath(num("volumeId"), str("path"), str("name"), actor));
      case "copy":
        return NextResponse.json(await copyPath(num("volumeId"), str("src"), str("dest")));
      case "mkdir":
        return NextResponse.json(await makeFolder(num("volumeId"), str("path")));
      case "delete":
        return NextResponse.json(
          await deleteAsset(num("assetId"), (str("mode") as "trash" | "decatalog") || "trash", actor)
        );
      case "trashFolder":
        return NextResponse.json(await trashFolder(num("volumeId"), str("path"), actor));
      default:
        return NextResponse.json({ error: `unknown op: ${op}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Collections (bundles): list + create/add/remove/reorder/rename/delete. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  listCollections, createCollection, deleteCollection, renameCollection,
  addToCollection, removeFromCollection, reorderCollection,
} from "@/studiolibrary/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ collections: await listCollections() });
}

export async function POST(req: Request) {
  const by = (await cookies()).get("studio_operator")?.value ?? null;
  const b = await req.json();
  try {
    switch (b.action) {
      case "create": {
        const c = await createCollection(String(b.name || "Untitled"), by, b.description);
        if (Array.isArray(b.assetIds) && b.assetIds.length) await addToCollection(c.id, b.assetIds.map(Number));
        return NextResponse.json({ collection: c });
      }
      case "add":
        return NextResponse.json({ added: await addToCollection(Number(b.collectionId), (b.assetIds ?? []).map(Number)) });
      case "remove":
        await removeFromCollection(Number(b.collectionId), Number(b.assetId));
        return NextResponse.json({ ok: true });
      case "reorder":
        await reorderCollection(Number(b.collectionId), (b.order ?? []).map(Number));
        return NextResponse.json({ ok: true });
      case "rename":
        await renameCollection(Number(b.collectionId), String(b.name));
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteCollection(Number(b.collectionId));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

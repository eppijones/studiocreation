/**
 * PUBLIC guest comment on a shared asset. Token-gated; only when the link
 * allows commenting. Guest comments sync straight into the asset's thread so
 * the internal team sees them (author tagged as the guest's name).
 */
import { NextResponse } from "next/server";
import { peekShareToken, shareAssetIds } from "@/studiolibrary/lib/collections";
import { addAnnotation } from "@/studiolibrary/lib/review";
import { addEvent } from "@/studiolibrary/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await peekShareToken(token);
  if (!link || !link.allow_comments) return NextResponse.json({ error: "commenting not allowed" }, { status: 403 });

  const b = await req.json();
  const assetId = Number(b.assetId);
  const ids = await shareAssetIds(link);
  if (!ids.includes(assetId)) return NextResponse.json({ error: "asset not in this link" }, { status: 403 });

  const name = (typeof b.name === "string" && b.name.trim()) ? b.name.trim().slice(0, 40) : "Guest reviewer";
  const a = await addAnnotation({
    assetId, kind: "comment", author: `${name} (guest)`,
    body: String(b.body ?? "").slice(0, 4000), tcIn: b.tcIn ?? null,
  });

  // Notify the share's creator that an external reviewer commented.
  const owner = link as { created_by_id?: number | null; created_by?: string | null };
  if (owner.created_by_id || owner.created_by) {
    await addEvent(assetId, name, "share_comment", {
      created_by_id: owner.created_by_id ?? null, created_by: owner.created_by ?? null,
      author: name, body: String(b.body ?? "").slice(0, 200),
    });
  }
  return NextResponse.json({ annotation: a });
}

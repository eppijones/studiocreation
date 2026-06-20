/**
 * Footage cards for the UNIFIED Home carousel. Shaped to match the app's
 * StudioAsset so the existing coverflow renders them with no changes; footage
 * carries a NEGATIVE id so the home can route it to /library/<id> (vs a render
 * which routes to /gallery/<id>) and so ids never collide with Neon renders.
 *
 * The carousel merge happens CLIENT-SIDE (renders from Neon + footage from
 * here), so the deck still shows renders if the local library DB is offline.
 */
import { NextResponse } from "next/server";
import { feedCards } from "@/studiolibrary/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await feedCards(24);
    const assets = cards.map((c) => ({
      id: -c.id, // negative → footage; home routes these to /library/<id>
      job_id: 0,
      blob_url: `/api/library/media/${c.id}/${c.thumbKind}`,
      content_type: c.thumbKind === "poster" || c.thumbKind === "sprite" ? "image/jpeg" : "image/png",
      width: null,
      height: null,
      duration_s: null,
      score: null,
      status: "footage",
      project: c.rel_path.split("/")[0] || "Media Library",
      label: c.filename,
      prompt: c.rel_path,
      model: c.kind, // small badge: video / image / audio / doc
      created_at: c.mtime ?? new Date(0).toISOString(),
      source: "footage" as const,
    }));
    return NextResponse.json({ assets });
  } catch {
    return NextResponse.json({ assets: [] }); // offline → carousel shows renders only
  }
}

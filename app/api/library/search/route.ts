/** Semantic search — text→vector ("by meaning") and asset→asset ("find similar"). */
import { NextResponse } from "next/server";
import { semanticSearch, similarToAsset } from "@/studiolibrary/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const similar = Number(u.searchParams.get("similarTo"));
  const q = u.searchParams.get("q") ?? "";
  const kind = u.searchParams.get("kind") ?? undefined;
  const modality = u.searchParams.get("modality");
  const limit = Number(u.searchParams.get("limit")) || undefined;

  try {
    const hits = Number.isInteger(similar) && similar > 0
      ? await similarToAsset(similar, { limit })
      : q.trim()
        ? await semanticSearch(q, {
            kind: kind || undefined,
            modality: modality === "frame" || modality === "transcript" ? modality : undefined,
            limit,
          })
        : [];
    // Return assets in the browse-grid shape, plus the match metadata.
    return NextResponse.json({
      assets: hits.map((h) => h.asset),
      hits: hits.map((h) => ({ id: h.asset.id, distance: h.distance, modality: h.modality, timecode_s: h.timecode_s })),
    });
  } catch (e) {
    // Embedder/model unavailable — signal the UI to fall back to lexical search.
    return NextResponse.json({ assets: [], hits: [], error: (e as Error).message, fallback: true }, { status: 200 });
  }
}

/** Browse/search feed for the Media Library grid. LOCAL library DB only. */
import { NextResponse } from "next/server";
import { searchAssets, commentCountsFor, type AssetFilters } from "@/studiolibrary/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const num = (k: string) => (u.searchParams.get(k) ? Number(u.searchParams.get(k)) : undefined);
  const filters: AssetFilters = {
    q: u.searchParams.get("q") ?? undefined,
    kinds: u.searchParams.get("kinds")?.split(",").filter(Boolean),
    codec: u.searchParams.get("codec") ?? undefined,
    minHeight: num("minHeight"),
    minDuration: num("minDuration"),
    maxDuration: num("maxDuration"),
    folder: u.searchParams.get("folder") ?? undefined,
    reviewState: u.searchParams.get("reviewState") ?? undefined,
    minRating: num("minRating"),
    sort: (u.searchParams.get("sort") as AssetFilters["sort"]) ?? "recent",
    limit: num("limit"),
    offset: num("offset"),
  };
  try {
    const assets = await searchAssets(filters);
    const counts = await commentCountsFor(assets.map((a) => a.id));
    return NextResponse.json({
      assets: assets.map((a) => ({ ...a, open_comments: counts[a.id] ?? 0 })),
    });
  } catch (e) {
    // Library DB down / not migrated — fail soft so the page can show a hint.
    return NextResponse.json({ assets: [], error: (e as Error).message }, { status: 200 });
  }
}

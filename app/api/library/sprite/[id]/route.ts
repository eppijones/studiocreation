/**
 * Lightweight sprite-grid lookup for card hover-scrub. Returns ONLY the sprite
 * proxy's grid (cols/rows/count) so a hover doesn't pull the full asset-detail
 * payload (6+ queries). Node runtime; reads the local library DB.
 */
import { NextResponse } from "next/server";
import { getProxy } from "@/studiolibrary/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sprite = await getProxy(Number(id), "sprite");
  const m = sprite?.meta as Record<string, unknown> | undefined;
  if (!sprite || sprite.status !== "ready" || !m || !Number(m.cols) || !Number(m.count)) {
    return NextResponse.json({ sprite: null });
  }
  const cols = Number(m.cols);
  const count = Number(m.count);
  return NextResponse.json({
    sprite: { cols, count, rows: Number(m.rows) || Math.ceil(count / cols) },
  });
}

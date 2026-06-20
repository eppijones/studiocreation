/**
 * PUBLIC share-viewer data (token-gated, no studio session). Returns only what
 * the link grants: the target asset(s), their ready proxy kinds, and comments
 * (if the link allows commenting). Bumps the view counter once per open.
 */
import { NextResponse } from "next/server";
import { consumeShareToken, shareAssetIds } from "@/studiolibrary/lib/collections";
import { listAnnotations } from "@/studiolibrary/lib/review";
import { sql } from "@/studiolibrary/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ShareAsset {
  id: number; kind: string; filename: string; rel_path: string;
  duration_s: number | null; fps: number | null; width: number | null; height: number | null;
  proxyKinds: string[]; sprite: Record<string, unknown> | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await consumeShareToken(token);
  if (!link) return NextResponse.json({ error: "link is invalid, expired, or revoked" }, { status: 404 });

  const ids = await shareAssetIds(link);
  if (!ids.length) return NextResponse.json({ error: "nothing shared" }, { status: 404 });

  const rows = await sql<{
    id: number; kind: string; filename: string; rel_path: string;
    duration_s: number | null; fps: number | null; width: number | null; height: number | null;
  }>`SELECT id, kind, filename, rel_path, duration_s, fps, width, height
     FROM assets WHERE id = ANY(${ids}) ORDER BY array_position(${ids}::int[], id)`;

  const proxies = await sql<{ asset_id: number; kind: string; meta: Record<string, unknown> }>`
    SELECT asset_id, kind, meta FROM proxies WHERE asset_id = ANY(${ids}) AND status = 'ready'`;

  const assets: ShareAsset[] = rows.map((a) => {
    const ps = proxies.filter((p) => p.asset_id === a.id);
    return {
      id: a.id, kind: a.kind, filename: a.filename, rel_path: a.rel_path,
      duration_s: a.duration_s, fps: a.fps, width: a.width, height: a.height,
      proxyKinds: ps.map((p) => p.kind),
      sprite: ps.find((p) => p.kind === "sprite")?.meta ?? null,
    };
  });

  // Comments only when the link permits review; reviewers see existing threads.
  const comments: Record<number, unknown[]> = {};
  if (link.allow_comments) {
    for (const id of ids) comments[id] = (await listAnnotations(id)).filter((c) => c.kind === "comment");
  }

  return NextResponse.json({
    link: {
      token: link.token, target_type: link.target_type, embed: link.embed,
      allow_comments: link.allow_comments, allow_download: link.allow_download,
      expires_at: link.expires_at,
    },
    assets,
    comments,
  });
}

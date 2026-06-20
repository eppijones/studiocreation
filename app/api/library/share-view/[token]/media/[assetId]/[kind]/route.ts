/**
 * PUBLIC, token-scoped proxy media for the share viewer. Validates the token
 * (no view bump) and that the asset is actually part of what the link shares,
 * then streams the proxy (range-aware). Proxies only — never originals.
 */
import { peekShareToken, shareAssetIds } from "@/studiolibrary/lib/collections";
import { serveProxy, PROXY_KINDS } from "@/studiolibrary/lib/serve";
import type { ProxyKind } from "@/studiolibrary/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string; assetId: string; kind: string }> }
) {
  const { token, assetId, kind } = await params;
  if (!PROXY_KINDS.has(kind as ProxyKind)) return new Response("bad kind", { status: 400 });

  const link = await peekShareToken(token);
  if (!link) return new Response("forbidden", { status: 403 });
  const ids = await shareAssetIds(link);
  if (!ids.includes(Number(assetId))) return new Response("forbidden", { status: 403 });

  return serveProxy(Number(assetId), kind as ProxyKind, req.headers.get("range"));
}

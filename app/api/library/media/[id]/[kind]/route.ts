/**
 * Serve a derivative (proxy / poster / sprite / thumb / waveform / page) for an
 * asset, range-aware for video. Authenticated (studio session). Originals are
 * NEVER served — proxies are the working surface. Node runtime only.
 */
import { serveProxy, PROXY_KINDS } from "@/studiolibrary/lib/serve";
import type { ProxyKind } from "@/studiolibrary/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!PROXY_KINDS.has(kind as ProxyKind)) return new Response("bad kind", { status: 400 });
  return serveProxy(Number(id), kind as ProxyKind, req.headers.get("range"));
}

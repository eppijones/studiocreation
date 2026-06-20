/**
 * Proxy file serving (range-aware) shared by the authenticated media route and
 * the public share-viewer media route. Serves PROXIES ONLY, always from under
 * PROXY_ROOT — never an original master.
 */
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import { getProxy, type ProxyKind } from "./repo";
import { PROXY_ROOT } from "./config/index";

const CONTENT_TYPE: Record<ProxyKind, string> = {
  video_proxy: "video/mp4",
  poster: "image/jpeg",
  sprite: "image/jpeg",
  thumb: "image/png",
  waveform: "image/png",
  page_preview: "image/png",
};

export const PROXY_KINDS = new Set<ProxyKind>([
  "video_proxy", "poster", "sprite", "thumb", "waveform", "page_preview",
]);

export async function serveProxy(assetId: number, kind: ProxyKind, rangeHeader: string | null): Promise<Response> {
  const proxy = await getProxy(assetId, kind);
  if (!proxy || proxy.status !== "ready" || !proxy.path) return new Response("not found", { status: 404 });

  const abs = resolve(proxy.path);
  if (!abs.startsWith(resolve(PROXY_ROOT))) return new Response("forbidden", { status: 403 });

  let size: number;
  try {
    size = statSync(abs).size;
  } catch {
    return new Response("not found", { status: 404 });
  }
  const contentType = CONTENT_TYPE[kind];

  if (rangeHeader && kind === "video_proxy") {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new Response("range not satisfiable", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = createReadStream(abs, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const stream = createReadStream(abs);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": kind === "video_proxy" ? "bytes" : "none",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

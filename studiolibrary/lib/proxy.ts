/**
 * Proxy + thumbnail generation. Proxies are the working/sharing surface;
 * originals stay put. Output lands in PROXY_ROOT/<assetId>/… — a SEPARATE,
 * writable location from the (read-only) masters.
 *
 * Per kind:
 *   video   → H.264 proxy (active Encoder adapter) + poster + scrub sprite
 *   image   → webp thumbnail
 *   audio   → waveform PNG
 *   doc      → PDF first-page preview (poppler, if present)
 *   project → metadata + icon only (no file; UI renders a kind icon)
 */
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { PROXY_ROOT, PROXY_PRESETS } from "./config/index";
import type { Volume } from "./volumes/types";
import { encoder } from "./encoders/index";
import { ffprobe, type ProbeResult } from "./media/ffprobe";
import {
  runFfmpeg, makePoster, makeSprite, makeImageThumb, makeWaveform, makePagePreview,
} from "./media/thumbnails";
import { upsertProxy, setAssetStatus, type AssetRow } from "./repo";

function assetDir(assetId: number): string {
  return join(PROXY_ROOT, String(assetId));
}

async function encodeVideoProxy(src: string, out: string, probe: ProbeResult): Promise<boolean> {
  const fps = probe.fps && probe.fps > 0 ? probe.fps : 30;
  const gopFrames = Math.max(1, Math.round(fps * PROXY_PRESETS.video.gopSeconds));
  const { code } = await runFfmpeg([
    ...encoder.inputArgs(),
    "-i", src,
    // Cap height at the preset; never upscale (the quotes protect the comma).
    "-vf", `scale=-2:'min(${PROXY_PRESETS.video.maxHeight},ih)'`,
    ...encoder.videoArgs({
      maxHeight: PROXY_PRESETS.video.maxHeight,
      bitrate: PROXY_PRESETS.video.bitrate,
      maxrate: PROXY_PRESETS.video.maxrate,
      gopFrames,
    }),
    "-c:a", "aac", "-b:a", "128k",
    out,
  ]);
  return code === 0;
}

/** Run all derivatives for one asset. Returns true if the asset is now usable. */
export async function processAsset(asset: AssetRow, volume: Volume): Promise<boolean> {
  const src = volume.absPath(asset.rel_path);
  const dir = assetDir(asset.id);
  // The proxy/thumbnail output dir must exist before the FIRST derivative runs
  // (the video proxy encode is first and would otherwise fail to open output).
  await mkdir(dir, { recursive: true });

  // Ensure we have technical metadata (poster/sprite need duration + dims).
  let probe: ProbeResult = {
    container: asset.container, codec: asset.codec, audioCodec: asset.audio_codec,
    width: asset.width, height: asset.height, durationS: asset.duration_s, fps: asset.fps,
  };
  if (asset.kind === "video" && (probe.durationS == null || probe.width == null)) {
    probe = await ffprobe(src);
  }

  let anyOk = false;

  if (asset.kind === "video") {
    const proxyOut = join(dir, `video_proxy.${PROXY_PRESETS.video.container}`);
    await upsertProxy(asset.id, "video_proxy", { status: "pending" });
    const ok = await encodeVideoProxy(src, proxyOut, probe);
    await upsertProxy(asset.id, "video_proxy", {
      path: ok ? proxyOut : null, codec: encoder.codecName, bitrate: PROXY_PRESETS.video.bitrate,
      status: ok ? "ready" : "error", error: ok ? null : "encode failed",
    });
    anyOk ||= ok;

    const posterOut = join(dir, "poster.jpg");
    const pok = await makePoster(src, posterOut, probe);
    await upsertProxy(asset.id, "poster", { path: pok ? posterOut : null, status: pok ? "ready" : "error" });

    const spriteOut = join(dir, "sprite.jpg");
    const sprite = await makeSprite(src, spriteOut, probe);
    await upsertProxy(asset.id, "sprite", {
      path: sprite ? spriteOut : null,
      meta: (sprite ?? {}) as unknown as Record<string, unknown>,
      status: sprite ? "ready" : "error",
    });
  } else if (asset.kind === "image") {
    const out = join(dir, `thumb.${PROXY_PRESETS.thumb.format}`);
    const ok = await makeImageThumb(src, out);
    await upsertProxy(asset.id, "thumb", { path: ok ? out : null, status: ok ? "ready" : "error" });
    anyOk ||= ok;
  } else if (asset.kind === "audio") {
    const out = join(dir, `waveform.${PROXY_PRESETS.waveform.format}`);
    const ok = await makeWaveform(src, out);
    await upsertProxy(asset.id, "waveform", { path: ok ? out : null, status: ok ? "ready" : "error" });
    anyOk ||= ok;
  } else if (asset.kind === "doc") {
    const page = await makePagePreview(src, join(dir, "page"));
    await upsertProxy(asset.id, "page_preview", {
      path: page, status: page ? "ready" : "error",
      error: page ? null : "poppler (pdftoppm) not available",
    });
    anyOk ||= !!page;
  } else if (asset.kind === "project") {
    // Project files: metadata + icon only — no derivative file to render.
    anyOk = true;
  }

  await setAssetStatus(asset.id, anyOk ? "proxied" : "error", anyOk ? undefined : "no derivative produced");
  return anyOk;
}

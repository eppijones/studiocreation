/**
 * Codec-agnostic derivative renders: video poster, scrub sprite, image thumb,
 * audio waveform, PDF page-preview. These are plain ffmpeg/poppler filters and
 * do NOT vary by GPU, so they live outside the Encoder adapter. The video
 * PROXY re-encode (which IS hardware-specific) lives in ../proxy.ts.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PROXY_PRESETS } from "../config/index";
import type { ProbeResult } from "./ffprobe";

export function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", (code) => resolve({ code: code ?? 0, stderr }));
    p.on("error", (e) => resolve({ code: 1, stderr: String(e) }));
  });
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

function evenDims(width: number, height: number, targetW: number): { w: number; h: number } {
  const w = targetW;
  const h = Math.max(2, Math.round((targetW * height) / width / 2) * 2);
  return { w, h };
}

/** Single representative still ~10% into the clip. */
export async function makePoster(src: string, out: string, probe: ProbeResult): Promise<boolean> {
  await ensureDir(out);
  const at = Math.max(0, (probe.durationS ?? 0) * (PROXY_PRESETS.poster.atPercent / 100));
  const { code } = await runFfmpeg([
    "-ss", at.toFixed(2),
    "-i", src,
    "-frames:v", "1",
    "-vf", `scale=${PROXY_PRESETS.poster.width}:-2`,
    "-q:v", String(PROXY_PRESETS.poster.quality),
    out,
  ]);
  return code === 0;
}

export interface SpriteMeta {
  cols: number;
  rows: number;
  count: number;
  tileW: number;
  tileH: number;
  intervalS: number;
}

/** Tiled sprite sheet for hover/scrub. Returns geometry for the UI to slice. */
export async function makeSprite(src: string, out: string, probe: ProbeResult): Promise<SpriteMeta | null> {
  const duration = probe.durationS ?? 0;
  if (duration <= 0 || !probe.width || !probe.height) return null;
  await ensureDir(out);

  const { tileWidth, cols, frames } = PROXY_PRESETS.sprite;
  const count = Math.min(frames, Math.max(1, Math.floor(duration)));
  const rows = Math.ceil(count / cols);
  const { h: tileH } = evenDims(probe.width, probe.height, tileWidth);
  const rate = count / duration; // frames per second to sample

  const { code } = await runFfmpeg([
    "-i", src,
    "-vf", `fps=${rate.toFixed(4)},scale=${tileWidth}:-2,tile=${cols}x${rows}`,
    "-frames:v", "1",
    "-q:v", "5",
    out,
  ]);
  if (code !== 0) return null;
  return { cols, rows, count, tileW: tileWidth, tileH, intervalS: duration / count };
}

/** Image thumbnail (webp). */
export async function makeImageThumb(src: string, out: string): Promise<boolean> {
  await ensureDir(out);
  // Downscale only (never upscale), keep aspect, force even height.
  const { code } = await runFfmpeg([
    "-i", src,
    "-vf", `scale='min(${PROXY_PRESETS.thumb.width},iw)':-2`,
    "-frames:v", "1",
    out,
  ]);
  return code === 0;
}

/** Audio waveform PNG — clean centered waveform on a transparent canvas with a
 *  faint center line, so it reads well at any size and over any card bg. */
export async function makeWaveform(src: string, out: string): Promise<boolean> {
  await ensureDir(out);
  const { width, height } = PROXY_PRESETS.waveform;
  // Mix to mono for one crisp trace, draw a soft accent waveform, overlay a thin
  // center guide line. Transparent background (rgba) so cards control the bg.
  const filter =
    `[0:a]aformat=channel_layouts=mono,` +
    `showwavespic=s=${width}x${height}:colors=#8a7cff@0.95:scale=sqrt:draw=full[w];` +
    `color=c=#5ad1c0@0.0:s=${width}x${height},format=rgba[bg];` +
    `[bg][w]overlay=format=auto[out]`;
  const { code } = await runFfmpeg([
    "-i", src,
    "-filter_complex", filter,
    "-map", "[out]",
    "-frames:v", "1",
    out,
  ]);
  if (code === 0) return true;
  // Fallback to the simple form if the build rejects a filter option.
  const f2 = await runFfmpeg([
    "-i", src,
    "-filter_complex", `showwavespic=s=${width}x${height}:colors=#8a7cff`,
    "-frames:v", "1", out,
  ]);
  return f2.code === 0;
}

/** PDF first-page raster via poppler's pdftoppm, if available. */
export async function makePagePreview(src: string, outNoExt: string): Promise<string | null> {
  const has = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" });
  if (has.error) return null; // poppler not installed — caller falls back to icon
  await ensureDir(outNoExt);
  const r = spawnSync("pdftoppm", [
    "-png", "-f", "1", "-l", "1", "-singlefile",
    "-scale-to-x", String(PROXY_PRESETS.pagePreview.width), "-scale-to-y", "-1",
    src, outNoExt,
  ]);
  return r.status === 0 ? `${outNoExt}.png` : null;
}

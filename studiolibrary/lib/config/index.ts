/**
 * StudioLibrary — single source of truth for the Media Library engine.
 *
 * Proxy presets, encoder choice, volume definitions, file-kind mapping and
 * share policy all live here. Dev→prod is a CONFIG SWAP, not a code change:
 * flip LIBRARY_ENCODER from "videotoolbox" to "nvenc" and add an SMB volume,
 * everything else carries over. Crawler / worker / player only read this.
 *
 * This module is Node-only (read by API routes on the nodejs runtime and by
 * the worker). It never ships to the client and never deploys to Vercel edge.
 */

export type VolumeKind = "local" | "smb";
export type EncoderId = "videotoolbox" | "nvenc" | "windows-ffmpeg";
export type AssetKind = "video" | "image" | "audio" | "doc" | "project";

export interface VolumeDef {
  /** Stable, human name — shows in the UI and seeds the `volumes` table. */
  name: string;
  kind: VolumeKind;
  /** Absolute filesystem root. For SMB this is the mountpoint, mounted `ro`. */
  root: string;
  /** Masters are NEVER written. Proxies/thumbs land here (separate, writable). */
  readOnly: boolean;
}

const REPO_ROOT = process.cwd();

/**
 * Volumes. Phase 0 = the LocalVolume test fixture only. The Oslo switch ADDS an
 * SMB volume here (it never replaces the local one — one DB, many volumes), and
 * sets LIBRARY_ENCODER=nvenc. The local test volume persists forever.
 */
export const VOLUMES: VolumeDef[] = [
  {
    name: "Mac Test Volume",
    kind: "local",
    root:
      process.env.LIBRARY_LOCAL_ROOT ??
      `${REPO_ROOT}/studiolibrary/test-media`,
    // The LOCAL dev volume is WRITABLE — it's a working fixture you manage
    // (move/rename/organize on disk via the web UI). The on-prem archive
    // (SMBVolume) is ALWAYS readOnly:true — masters are never mutated there.
    readOnly: false,
  },
  // Oslo (later — do NOT enable before connecting in Oslo):
  // { name: "Archive (on-prem)", kind: "smb", root: "/mnt/archive", readOnly: true },
];

/** Active encoder — the ONLY thing that changes for the Mac→A6000 switch. */
export const LIBRARY_ENCODER: EncoderId =
  (process.env.LIBRARY_ENCODER as EncoderId) ?? "videotoolbox";

/** Writable proxy/thumbnail output — a SEPARATE location from masters. */
export const PROXY_ROOT =
  process.env.LIBRARY_PROXY_ROOT ?? `${REPO_ROOT}/studiolibrary/proxies`;

/** Append-only ingest manifest (mirrors the app's assets/manifest.jsonl idea). */
export const INGEST_MANIFEST = `${REPO_ROOT}/studiolibrary/.cache/ingest.manifest.jsonl`;

/** Proxy/thumbnail presets — the working surface; originals stay put. */
export const PROXY_PRESETS = {
  /** ~1080p H.264, dense GOP for snap-seek scrubbing. ~6–10 Mbps. */
  video: {
    maxHeight: 1080,
    bitrate: "6M",
    maxrate: "9M",
    /** keyframe every ~1s of motion → fast, accurate seeking */
    gopSeconds: 1,
    container: "mp4",
  },
  /** Single representative still for grids/cards. */
  poster: { width: 640, atPercent: 10, format: "jpg" as const, quality: 4 },
  /** Hover/scrub sprite strip: a tiled sheet of frames + a manifest. */
  sprite: { tileWidth: 240, cols: 5, frames: 40, format: "jpg" as const },
  /** Image thumbnail. PNG keeps logo transparency and needs no webp encoder
   *  (not all ffmpeg builds ship libwebp). */
  thumb: { width: 640, format: "png" as const },
  /** Audio waveform PNG — high-res, centered, brand-tinted, transparent bg. */
  waveform: { width: 1600, height: 400, format: "png" as const },
  /** PDF first-page raster. */
  pagePreview: { width: 800, format: "png" as const },
} as const;

/** Worker concurrency. Video transcode is the heavy lane — keep it small. */
export const QUEUE_CONCURRENCY = {
  proxy: Number(process.env.LIBRARY_PROXY_CONCURRENCY ?? 2),
  transcribe: Number(process.env.LIBRARY_TRANSCRIBE_CONCURRENCY ?? 1),
  default: 4,
} as const;

/** External shares serve PROXIES ONLY. Originals never leave the building. */
export const SHARE_POLICY = {
  serve: "proxy" as const,
  allowOriginalDownload: false,
} as const;

/** AI model choices — local-first; API fallback OFF by default (offline-safe). */
export const AI_MODELS = {
  transcribe: { engine: "faster-whisper", model: "base", apiFallback: false },
  // Phase 2 — vision tags + embeddings (local model; API fallback off):
  embed: { engine: "local", dim: 768, apiFallback: false },
} as const;

/** Local Whisper (faster-whisper) — CPU/int8 on the Mac, "cuda" on the A6000.
 *  Runs in its own Python venv so it never touches the Node toolchain. */
export const WHISPER = {
  python: process.env.WHISPER_PYTHON ?? `${REPO_ROOT}/studiolibrary/.venv/bin/python`,
  script: `${REPO_ROOT}/studiolibrary/worker/transcribe.py`,
  model: process.env.WHISPER_MODEL ?? AI_MODELS.transcribe.model,
  device: process.env.WHISPER_DEVICE ?? "cpu", // flip to "cuda" in Oslo
} as const;

// ── File-kind detection ─────────────────────────────────────────────────────
const EXT_KIND: Record<string, AssetKind> = {
  // video
  mp4: "video", mov: "video", mxf: "video", mkv: "video", webm: "video",
  m4v: "video", avi: "video", hevc: "video", m2ts: "video", mts: "video",
  // image
  png: "image", jpg: "image", jpeg: "image", tif: "image", tiff: "image",
  webp: "image", gif: "image", bmp: "image", heic: "image", heif: "image", avif: "image",
  // audio
  mp3: "audio", wav: "audio", aif: "audio", aiff: "audio", flac: "audio",
  m4a: "audio", aac: "audio", ogg: "audio",
  // doc
  pdf: "doc",
  // project files (metadata + icon only)
  prproj: "project", psb: "project", psd: "project", aep: "project",
  drp: "project", c4d: "project", blend: "project", fcpbundle: "project",
};

export function kindForExt(ext: string): AssetKind | null {
  return EXT_KIND[ext.toLowerCase().replace(/^\./, "")] ?? null;
}

/** Display category for the file-explorer — covers non-indexed files too
 *  (archives, disk images, installers, code) so the explorer can show a tile
 *  for everything on disk, like Finder/Explorer. */
export type DisplayKind = AssetKind | "archive" | "disk" | "installer" | "code" | "other";
const EXT_DISPLAY: Record<string, DisplayKind> = {
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  dmg: "disk", iso: "disk", img: "disk",
  exe: "installer", msi: "installer", pkg: "installer", app: "installer",
  js: "code", ts: "code", py: "code", json: "code", sh: "code", html: "code", css: "code",
};
export function displayKindForExt(ext: string): DisplayKind {
  return kindForExt(ext) ?? EXT_DISPLAY[ext.toLowerCase().replace(/^\./, "")] ?? "other";
}

export function extOf(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/** Files/dirs the crawler skips (junk, hidden, sidecars). */
export function isIgnoredPath(name: string): boolean {
  return (
    name.startsWith(".") ||
    name === "__MACOSX" ||
    name.endsWith(".tmp") ||
    name.endsWith(".part") ||
    name === "Thumbs.db"
  );
}

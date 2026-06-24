/* Shared types + helpers for the Media Library surface. The page is the stateful
   orchestrator; tree / inspector / cards / views are presentational and import
   their data shapes + format helpers from here. */

export interface Asset {
  id: number;
  kind: "video" | "image" | "audio" | "doc" | "project";
  filename: string;
  rel_path: string;
  codec: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  size_bytes: string | null;
  review_state: string | null;
  rating: number | null;
  open_comments: number;
  volume_id: number | null;
}
export interface ReviewState { key: string; label: string; color: string; ord: number; kind: string | null; }
export interface Collection { id: number; name: string; count: number; cover_asset_id: number | null; }
export interface Volume { id: number; name: string; kind: string; read_only: boolean; assets: number; status: string; }

export type DisplayKind =
  | "video" | "image" | "audio" | "doc" | "project"
  | "archive" | "disk" | "installer" | "code" | "other";
export interface BrowseAsset {
  id: number;
  kind: "video" | "image" | "audio" | "doc" | "project";
  review_state: string | null;
  rating: number | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  status: string;
  open_comments: number;
}
export interface BrowseFile {
  name: string;
  ext: string;
  relPath: string;
  displayKind: DisplayKind;
  sizeBytes: number;
  asset: BrowseAsset | null;
}
export interface BrowseFolder { name: string; path: string; count: number; }
export interface BrowseResult {
  volumeId: number;
  path: string;
  breadcrumb: { name: string; path: string }[];
  folders: BrowseFolder[];
  files: BrowseFile[];
  readOnly: boolean;
  error?: string;
}
export interface Status {
  total: number;
  byKind: { kind: string; n: number }[];
  byStatus: { status: string; n: number }[];
  jobs: Record<string, number>;
  volumes: Volume[];
  folders: { folder: string; n: number }[];
  facets: { codecs: string[]; kinds: string[] };
  reviewStates: ReviewState[];
  collections: Collection[];
  error?: string;
}

// Full single-asset detail (mirrors studiolibrary assetDetail) — fed to the Inspector.
export interface AssetDetail {
  asset: {
    id: number; volume_id: number; rel_path: string; filename: string; kind: string;
    ext: string | null; size_bytes: string | null; container: string | null; codec: string | null;
    width: number | null; height: number | null; duration_s: number | null; fps: number | null;
    audio_codec: string | null; mtime: string | null; status: string; discovered_at: string;
    review_state?: string; rating?: number | null;
  };
  proxies: { kind: string; status: string; path: string | null }[];
  tags: { label: string; source: string; confidence: number | null; timecode_s: number | null }[];
  events: { id: number; actor: string | null; type: string; payload: Record<string, unknown>; created_at: string }[];
}

export const THUMB_KIND: Record<string, string | null> = {
  video: "poster", image: "thumb", audio: "waveform", doc: "page_preview", project: null,
};
export const KIND_ICON: Record<string, string> = {
  video: "film", image: "image", audio: "audio", doc: "briefs", project: "tools",
};
export const DISPLAY_ICON: Record<DisplayKind, string> = {
  video: "film", image: "image", audio: "audio", doc: "briefs", project: "tools",
  archive: "layers", disk: "drive", installer: "bolt", code: "cpu", other: "copy",
};
export const KIND_ORDER = ["video", "image", "audio", "doc", "project"];

export function fmtDur(s: number | null): string | null {
  if (!s || s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
export function fmtSize(b: string | null): string | null {
  if (!b) return null;
  const n = Number(b);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
/** A short resolution label (8K / 4K / 1080p …) from a height. */
export function resLabel(height: number | null): string | null {
  if (!height) return null;
  if (height >= 4320) return "8K";
  if (height >= 2880) return "6K";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  return `${height}p`;
}
/** Mono color token for a resolution tier — gold for 8K down to muted for SD. */
export function resColor(height: number | null): string {
  if (!height) return "var(--tx-4)";
  if (height >= 2880) return "var(--starxi)";   // gold
  if (height >= 2160) return "var(--accent-hi)"; // 4K pops accent
  if (height >= 1080) return "var(--tx-2)";
  return "var(--tx-3)";
}
/** The folder portion of a rel_path (everything before the final segment). */
export function folderOf(relPath: string): string {
  const i = relPath.lastIndexOf("/");
  return i < 0 ? "" : relPath.slice(0, i);
}
/** Deterministic 0–360 hue from a string — drives per-folder mesh art + dots so
    each folder keeps a stable colour without any fabricated metadata. */
export function hueFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
/** Adapt an indexed explorer file (BrowseFile w/ asset) to the Asset card shape. */
export function assetFromBrowseFile(f: BrowseFile, a: BrowseAsset, volumeId: number | null): Asset {
  return {
    id: a.id, kind: a.kind, filename: f.name, rel_path: f.relPath,
    codec: a.codec, width: a.width, height: a.height, duration_s: a.duration_s,
    size_bytes: f.sizeBytes != null ? String(f.sizeBytes) : null,
    review_state: a.review_state, rating: a.rating, open_comments: a.open_comments,
    volume_id: volumeId,
  };
}

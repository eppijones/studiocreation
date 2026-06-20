/**
 * Filesystem browse — the file-explorer view. Lists the immediate subfolders +
 * files of a path on a volume (the real on-disk tree, including non-media
 * files), and joins indexed media so each file tile shows its asset metadata
 * (review state, rating, comments, thumbnail) when we have it.
 */
import { query } from "./db/client";
import { makeVolume } from "./volumes/index";
import { displayKindForExt, type DisplayKind } from "./config/index";
import { getVolumeById } from "./repo";
import { openCommentCounts } from "./review";

export interface BrowseFile {
  name: string;
  ext: string;
  relPath: string;
  displayKind: DisplayKind;
  sizeBytes: number;
  asset: {
    id: number; kind: string; review_state: string | null; rating: number | null;
    duration_s: number | null; width: number | null; height: number | null;
    codec: string | null; status: string; open_comments: number;
  } | null;
}
export interface BrowseFolder { name: string; path: string; count: number }
export interface BrowseResult {
  volumeId: number;
  path: string;
  breadcrumb: { name: string; path: string }[];
  folders: BrowseFolder[];
  files: BrowseFile[];
  readOnly: boolean;
}

export async function browseFolder(volumeId: number, path: string): Promise<BrowseResult> {
  const vrow = await getVolumeById(volumeId);
  if (!vrow) throw new Error("volume not found");
  const volume = makeVolume({ name: vrow.name, kind: vrow.kind, root: vrow.root, readOnly: vrow.read_only });

  const clean = path.replace(/^\/+|\/+$/g, "");
  const { dirs, files } = await volume.list(clean);

  // Join indexed assets for the files directly in this folder.
  const relPaths = files.map((f) => (clean ? `${clean}/${f.name}` : f.name));
  const assetRows = relPaths.length
    ? await query<{
        id: number; rel_path: string; kind: string; review_state: string | null;
        rating: number | null; duration_s: number | null; width: number | null;
        height: number | null; codec: string | null; status: string;
      }>(
        `SELECT id, rel_path, kind, review_state, rating, duration_s, width, height, codec, status
         FROM assets WHERE volume_id = $1 AND rel_path = ANY($2)`,
        [volumeId, relPaths]
      )
    : [];
  const byPath = new Map(assetRows.map((a) => [a.rel_path, a]));
  const counts = await openCommentCounts(assetRows.map((a) => a.id));

  const fileTiles: BrowseFile[] = files.map((f) => {
    const rel = clean ? `${clean}/${f.name}` : f.name;
    const a = byPath.get(rel);
    return {
      name: f.name, ext: f.ext, relPath: rel,
      displayKind: displayKindForExt(f.ext), sizeBytes: f.sizeBytes,
      asset: a ? { ...a, open_comments: counts[a.id] ?? 0 } : null,
    };
  });

  // Per-immediate-subfolder asset counts (recursive under each subfolder).
  const countRows = await query<{ seg: string; n: string }>(
    `SELECT split_part(CASE WHEN $2 = '' THEN rel_path ELSE substring(rel_path FROM char_length($2) + 2) END, '/', 1) AS seg,
            count(*) AS n
     FROM assets
     WHERE volume_id = $1 AND missing_at IS NULL AND ($2 = '' OR rel_path LIKE $2 || '/%')
     GROUP BY seg`,
    [volumeId, clean]
  );
  const dirCounts = new Map(countRows.map((r) => [r.seg, Number(r.n)]));

  const folders: BrowseFolder[] = dirs.map((d) => ({
    name: d.name,
    path: clean ? `${clean}/${d.name}` : d.name,
    count: dirCounts.get(d.name) ?? 0,
  }));

  // Breadcrumb segments with cumulative paths.
  const breadcrumb: { name: string; path: string }[] = [{ name: "Library", path: "" }];
  let acc = "";
  for (const seg of clean ? clean.split("/") : []) {
    acc = acc ? `${acc}/${seg}` : seg;
    breadcrumb.push({ name: seg, path: acc });
  }

  return { volumeId, path: clean, breadcrumb, folders, files: fileTiles, readOnly: vrow.read_only };
}

/**
 * Read-side queries for the Media Library UI + API (browse, filter, search,
 * asset detail, stats, home feed). All against the LOCAL library DB.
 */
import { sql, query } from "./db/client";
import type { AssetRow, ProxyRow } from "./repo";
import {
  listAnnotations, listEvents, listSubclips, openCommentCounts,
  type Annotation, type AssetEvent, type Subclip,
} from "./review";

export interface AssetFilters {
  q?: string;
  kinds?: string[];
  codec?: string;
  minHeight?: number;
  minDuration?: number;
  maxDuration?: number;
  folder?: string;
  reviewState?: string;
  minRating?: number;
  sort?: "recent" | "name" | "duration" | "size" | "rating";
  limit?: number;
  offset?: number;
}

/** Filtered/sorted asset list for the browse grid. Excludes missing files. */
export async function searchAssets(f: AssetFilters): Promise<AssetRow[]> {
  const where: string[] = ["missing_at IS NULL"];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };

  if (f.q && f.q.trim()) {
    // Filename/path full-text OR substring (covers partial filenames).
    where.push(`(fts @@ plainto_tsquery('simple', ${p(f.q)}) OR rel_path ILIKE ${p(`%${f.q}%`)})`);
  }
  if (f.kinds?.length) where.push(`kind = ANY(${p(f.kinds)})`);
  if (f.codec) where.push(`codec = ${p(f.codec)}`);
  if (f.minHeight) where.push(`height >= ${p(f.minHeight)}`);
  if (f.minDuration != null) where.push(`duration_s >= ${p(f.minDuration)}`);
  if (f.maxDuration != null) where.push(`duration_s <= ${p(f.maxDuration)}`);
  if (f.folder) where.push(`rel_path LIKE ${p(`${f.folder}/%`)}`);
  if (f.reviewState) where.push(`review_state = ${p(f.reviewState)}`);
  if (f.minRating) where.push(`rating >= ${p(f.minRating)}`);

  const order =
    f.sort === "name" ? "filename ASC"
    : f.sort === "duration" ? "duration_s DESC NULLS LAST"
    : f.sort === "size" ? "size_bytes DESC NULLS LAST"
    : f.sort === "rating" ? "rating DESC NULLS LAST, mtime DESC"
    : "mtime DESC NULLS LAST, id DESC";

  const limit = Math.min(Math.max(f.limit ?? 100, 1), 500);
  const offset = Math.max(f.offset ?? 0, 0);

  return query<AssetRow>(
    `SELECT * FROM assets WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
    params
  );
}

/** Leaf folders (dir of each rel_path) with asset counts — builds the tree. */
export async function folderCounts(): Promise<{ folder: string; n: number }[]> {
  const r = await sql<{ folder: string; n: string }>`
    SELECT regexp_replace(rel_path, '/[^/]*$', '') AS folder, count(*) AS n
    FROM assets WHERE missing_at IS NULL
    GROUP BY folder ORDER BY folder
  `;
  return r.map((x) => ({ folder: x.folder, n: Number(x.n) }));
}

/** Distinct facet values for the filter rail. */
export async function facets(): Promise<{ codecs: string[]; kinds: string[] }> {
  const codecs = await sql<{ codec: string }>`
    SELECT DISTINCT codec FROM assets WHERE codec IS NOT NULL AND missing_at IS NULL ORDER BY codec
  `;
  const kinds = await sql<{ kind: string }>`
    SELECT DISTINCT kind FROM assets WHERE missing_at IS NULL ORDER BY kind
  `;
  return { codecs: codecs.map((c) => c.codec), kinds: kinds.map((k) => k.kind) };
}

export interface AssetDetail {
  asset: AssetRow & { review_state?: string; rating?: number | null; custom?: Record<string, unknown> };
  proxies: ProxyRow[];
  transcript: { language: string | null; full_text: string | null; segments: unknown[] } | null;
  tags: { label: string; source: string; confidence: number | null; timecode_s: number | null }[];
  annotations: Annotation[];
  events: AssetEvent[];
  subclips: Subclip[];
}

export async function assetDetail(id: number): Promise<AssetDetail | null> {
  const a = await sql<AssetRow>`SELECT * FROM assets WHERE id = ${id}`;
  if (!a[0]) return null;
  const proxies = await sql<ProxyRow>`SELECT * FROM proxies WHERE asset_id = ${id}`;
  const t = await sql<{ language: string | null; full_text: string | null; segments: unknown[] }>`
    SELECT language, full_text, segments FROM transcripts WHERE asset_id = ${id}
  `;
  const tags = await sql<{ label: string; source: string; confidence: number | null; timecode_s: number | null }>`
    SELECT label, source, confidence, timecode_s FROM tags WHERE asset_id = ${id} ORDER BY timecode_s NULLS FIRST
  `;
  const [annotations, events, subclips] = await Promise.all([
    listAnnotations(id), listEvents(id), listSubclips(id),
  ]);
  return { asset: a[0], proxies, transcript: t[0] ?? null, tags, annotations, events, subclips };
}

/** Map of assetId → open (unresolved) comment count, for grid badges. */
export async function commentCountsFor(assetIds: number[]): Promise<Record<number, number>> {
  return openCommentCounts(assetIds);
}

export interface LibraryStats {
  byKind: { kind: string; n: number }[];
  byStatus: { status: string; n: number }[];
  jobs: Record<string, number>;
  volumes: { id: number; name: string; kind: string; root: string; status: string; read_only: boolean; assets: number }[];
  total: number;
}

export async function libraryStats(): Promise<LibraryStats> {
  const byKind = await sql<{ kind: string; n: string }>`
    SELECT kind, count(*) n FROM assets WHERE missing_at IS NULL GROUP BY kind ORDER BY kind`;
  const byStatus = await sql<{ status: string; n: string }>`
    SELECT status, count(*) n FROM assets GROUP BY status ORDER BY status`;
  const jobsRows = await sql<{ state: string; n: string }>`
    SELECT state, count(*) n FROM jobs GROUP BY state`;
  const vols = await sql<{ id: number; name: string; kind: string; root: string; status: string; read_only: boolean; assets: string }>`
    SELECT v.id, v.name, v.kind, v.root, v.status, v.read_only, count(a.id) assets
    FROM volumes v LEFT JOIN assets a ON a.volume_id = v.id AND a.missing_at IS NULL
    GROUP BY v.id ORDER BY v.id`;
  const total = byKind.reduce((s, x) => s + Number(x.n), 0);
  return {
    byKind: byKind.map((x) => ({ kind: x.kind, n: Number(x.n) })),
    byStatus: byStatus.map((x) => ({ status: x.status, n: Number(x.n) })),
    jobs: Object.fromEntries(jobsRows.map((x) => [x.state, Number(x.n)])),
    volumes: vols.map((v) => ({ id: v.id, name: v.name, kind: v.kind, root: v.root, status: v.status, read_only: v.read_only, assets: Number(v.assets) })),
    total,
  };
}

/** Cards for the unified Home carousel — newest footage with a visual proxy. */
export async function feedCards(limit = 24): Promise<
  { id: number; kind: string; filename: string; rel_path: string; mtime: string | null; thumbKind: string }[]
> {
  const r = await sql<{ id: number; kind: string; filename: string; rel_path: string; mtime: string | null; thumb_kind: string }>`
    SELECT a.id, a.kind, a.filename, a.rel_path, a.mtime,
           p.kind AS thumb_kind
    FROM assets a
    JOIN proxies p ON p.asset_id = a.id AND p.status = 'ready'
      AND p.kind IN ('poster','thumb','waveform','page_preview')
    WHERE a.missing_at IS NULL
    ORDER BY a.mtime DESC NULLS LAST, a.id DESC
    LIMIT ${limit}
  `;
  return r.map((x) => ({
    id: x.id, kind: x.kind, filename: x.filename, rel_path: x.rel_path, mtime: x.mtime, thumbKind: x.thumb_kind,
  }));
}

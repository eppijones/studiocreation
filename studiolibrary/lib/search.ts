/**
 * Semantic search over the pgvector embeddings (Phase 3). text→vector and
 * frame→frame both query ONE cosine ANN index (open_clip joint space). Falls
 * back gracefully: if the embedder/model is unavailable, callers catch and the
 * UI uses lexical search instead.
 */
import { query } from "./db/client";
import { embedQuery } from "./embed";
import type { AssetRow } from "./repo";

export interface SemanticHit {
  asset: AssetRow;
  distance: number;
  modality: string;
  timecode_s: number | null;
}

interface RawHit { asset_id: number; modality: string; timecode_s: number | null; distance: number }

/** Dedupe ANN hits to one (best) row per asset, then hydrate asset rows. */
async function hydrate(raw: RawHit[], limit: number): Promise<SemanticHit[]> {
  const best = new Map<number, RawHit>();
  for (const r of raw) {
    const cur = best.get(r.asset_id);
    if (!cur || r.distance < cur.distance) best.set(r.asset_id, r);
  }
  const top = [...best.values()].sort((a, b) => a.distance - b.distance).slice(0, limit);
  const ids = top.map((r) => r.asset_id);
  if (!ids.length) return [];
  const assets = await query<AssetRow>(`SELECT * FROM assets WHERE id = ANY($1)`, [ids]);
  const byId = new Map(assets.map((a) => [a.id, a]));
  return top
    .filter((r) => byId.has(r.asset_id))
    .map((r) => ({ asset: byId.get(r.asset_id)!, distance: Number(r.distance), modality: r.modality, timecode_s: r.timecode_s }));
}

/** text → vector → nearest assets. opts.modality restricts to frame ("shown") or transcript ("said"). */
export async function semanticSearch(
  text: string, opts?: { kind?: string; modality?: "frame" | "transcript"; limit?: number }
): Promise<SemanticHit[]> {
  const vec = await embedQuery(text);
  if (!vec.length) return [];
  const lit = `[${vec.join(",")}]`;
  const limit = Math.min(opts?.limit ?? 40, 200);

  const params: unknown[] = [lit];
  const clauses: string[] = ["a.missing_at IS NULL"];
  if (opts?.kind) { params.push(opts.kind); clauses.push(`a.kind = $${params.length}`); }
  if (opts?.modality) { params.push(opts.modality); clauses.push(`e.modality = $${params.length}`); }

  // Pull a few× the target so per-asset dedupe still leaves `limit` assets.
  const raw = await query<RawHit>(
    `SELECT e.asset_id, e.modality, e.timecode_s, (e.vector <=> $1::vector) AS distance
     FROM embeddings e JOIN assets a ON a.id = e.asset_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY e.vector <=> $1::vector
     LIMIT ${limit * 5}`,
    params
  );
  return hydrate(raw, limit);
}

/** "Find similar to this asset" — probe with one of its frame vectors. */
export async function similarToAsset(assetId: number, opts?: { limit?: number }): Promise<SemanticHit[]> {
  const probe = await query<{ v: string }>(
    `SELECT vector::text AS v FROM embeddings WHERE asset_id = $1 AND modality = 'frame' LIMIT 1`,
    [assetId]
  );
  if (!probe[0]) return [];
  const limit = Math.min(opts?.limit ?? 24, 200);
  const raw = await query<RawHit>(
    `SELECT e.asset_id, e.modality, e.timecode_s, (e.vector <=> $1::vector) AS distance
     FROM embeddings e JOIN assets a ON a.id = e.asset_id
     WHERE a.missing_at IS NULL AND e.asset_id <> $2 AND e.modality = 'frame'
     ORDER BY e.vector <=> $1::vector
     LIMIT ${limit * 5}`,
    [probe[0].v, assetId]
  );
  return hydrate(raw, limit);
}

/** Whether any embeddings exist yet (so the UI can hide semantic search if dark). */
export async function hasEmbeddings(): Promise<boolean> {
  const r = await query<{ n: string }>(`SELECT count(*) n FROM embeddings`);
  return Number(r[0]?.n ?? 0) > 0;
}

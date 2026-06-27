/**
 * Media Library data access. One place for the queries the crawler, worker and
 * API routes share. All against the LOCAL library DB (never Neon).
 */
import { sql, query } from "./db/client";
import type { AssetKind } from "./config/index";
import { fanOutEvent } from "./notify";

export interface VolumeRow {
  id: number;
  name: string;
  kind: "local" | "smb";
  root: string;
  read_only: boolean;
  status: string;
}

export interface AssetRow {
  id: number;
  volume_id: number;
  abs_path: string;
  rel_path: string;
  filename: string;
  kind: AssetKind;
  ext: string | null;
  size_bytes: string | null; // bigint → string in pg
  signature: string | null;
  container: string | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  fps: number | null;
  audio_codec: string | null;
  mtime: string | null;
  status: "new" | "proxied" | "enriched" | "error";
  missing_at: string | null;
  discovered_at: string;
}

export type ProxyKind =
  | "video_proxy" | "poster" | "sprite" | "waveform" | "page_preview" | "thumb";

export interface ProxyRow {
  id: number;
  asset_id: number;
  kind: ProxyKind;
  path: string | null;
  codec: string | null;
  bitrate: string | null;
  meta: Record<string, unknown>;
  status: "pending" | "ready" | "error";
  source: "generated" | "reused_external";
  error: string | null;
}

export type JobType = "index" | "proxy" | "transcribe" | "tag" | "embed";
export interface JobRow {
  id: number;
  type: JobType;
  asset_id: number | null;
  state: "queued" | "running" | "done" | "error" | "canceled";
  attempts: number;
  priority: number;
  payload: Record<string, unknown>;
  error: string | null;
}

// ── Volumes ─────────────────────────────────────────────────────────────────
export async function getVolumeByName(name: string): Promise<VolumeRow | null> {
  const r = await sql<VolumeRow>`SELECT * FROM volumes WHERE name = ${name}`;
  return r[0] ?? null;
}
export async function listVolumes(): Promise<VolumeRow[]> {
  return sql<VolumeRow>`SELECT * FROM volumes ORDER BY id`;
}
export async function getVolumeById(id: number): Promise<VolumeRow | null> {
  const r = await sql<VolumeRow>`SELECT * FROM volumes WHERE id = ${id}`;
  return r[0] ?? null;
}

/** Rewrite paths for a moved/renamed file or folder (prefix-rewrite). Keeps
 *  the asset rows (and thus their proxies/annotations) attached after a move. */
export async function rewriteAssetPaths(
  volumeId: number, oldRel: string, newRel: string, root: string
): Promise<number[]> {
  const r = await query<{ id: number }>(
    `UPDATE assets SET
       rel_path = $3 || substring(rel_path from char_length($2) + 1),
       abs_path = $4 || '/' || ($3 || substring(rel_path from char_length($2) + 1)),
       filename = regexp_replace($3 || substring(rel_path from char_length($2) + 1), '^.*/', '')
     WHERE volume_id = $1 AND (rel_path = $2 OR rel_path LIKE $2 || '/%')
     RETURNING id`,
    [volumeId, oldRel, newRel, root]
  );
  return r.map((x) => x.id);
}

/** Assets at or under a rel-path prefix (a file or a folder). */
export async function assetsUnderPrefix(volumeId: number, relPrefix: string): Promise<AssetRow[]> {
  return query<AssetRow>(
    `SELECT * FROM assets WHERE volume_id = $1 AND (rel_path = $2 OR rel_path LIKE $2 || '/%')`,
    [volumeId, relPrefix]
  );
}

export async function deleteAssetRow(id: number): Promise<void> {
  await sql`DELETE FROM assets WHERE id = ${id}`;
}

/** Append to the per-asset activity history, then fan out notifications. The
 *  fan-out is internally guarded (never throws) so it can't break the write. */
export async function addEvent(
  assetId: number, actor: string | null, type: string,
  payload: Record<string, unknown> = {}, actorId: number | null = null
): Promise<number> {
  const r = await sql<{ id: number }>`
    INSERT INTO asset_events (asset_id, actor, actor_id, type, payload)
    VALUES (${assetId}, ${actor}, ${actorId}, ${type}, ${JSON.stringify(payload)})
    RETURNING id
  `;
  const id = r[0].id;
  await fanOutEvent({ id, assetId, actorId, actorName: actor, type, payload });
  return id;
}

// ── Assets: idempotent discovery upsert with move-by-signature ──────────────
export interface DiscoveredMeta {
  relPath: string;
  absPath: string;
  filename: string;
  ext: string;
  kind: AssetKind;
  sizeBytes: number;
  mtime: Date;
  signature: string;
}

export type UpsertOutcome =
  | { kind: "inserted"; id: number }
  | { kind: "moved"; id: number; from: string }
  | { kind: "changed"; id: number }
  | { kind: "unchanged"; id: number };

/** Upsert a discovered file. Detects content changes and moves; clears the
 *  missing flag for anything seen this crawl. */
export async function upsertDiscovered(volumeId: number, m: DiscoveredMeta): Promise<UpsertOutcome> {
  const existing = await sql<{ id: number; signature: string | null }>`
    SELECT id, signature FROM assets WHERE volume_id = ${volumeId} AND abs_path = ${m.absPath}
  `;
  if (existing[0]) {
    const row = existing[0];
    const changed = row.signature !== m.signature;
    if (changed) {
      // Content changed under the same path → re-probe + re-proxy from scratch.
      await sql`
        UPDATE assets SET
          rel_path = ${m.relPath}, filename = ${m.filename}, ext = ${m.ext}, kind = ${m.kind},
          size_bytes = ${m.sizeBytes}, mtime = ${m.mtime.toISOString()},
          signature = ${m.signature}, last_seen_at = now(), missing_at = NULL,
          status = 'new', error = NULL
        WHERE id = ${row.id}
      `;
      return { kind: "changed", id: row.id };
    }
    await sql`
      UPDATE assets SET
        rel_path = ${m.relPath}, filename = ${m.filename}, ext = ${m.ext}, kind = ${m.kind},
        size_bytes = ${m.sizeBytes}, mtime = ${m.mtime.toISOString()},
        last_seen_at = now(), missing_at = NULL
      WHERE id = ${row.id}
    `;
    return { kind: "unchanged", id: row.id };
  }

  // Not at this path. A previously-missing asset with the same signature in this
  // volume is the SAME file MOVED — preserve its id (and its proxies/enrichment).
  const moved = await sql<{ id: number; abs_path: string }>`
    SELECT id, abs_path FROM assets
    WHERE volume_id = ${volumeId} AND signature = ${m.signature} AND missing_at IS NOT NULL
    LIMIT 1
  `;
  if (moved[0]) {
    await sql`
      UPDATE assets SET
        abs_path = ${m.absPath}, rel_path = ${m.relPath}, filename = ${m.filename},
        last_seen_at = now(), missing_at = NULL
      WHERE id = ${moved[0].id}
    `;
    return { kind: "moved", id: moved[0].id, from: moved[0].abs_path };
  }

  const inserted = await sql<{ id: number }>`
    INSERT INTO assets (volume_id, abs_path, rel_path, filename, kind, ext, size_bytes, mtime, signature)
    VALUES (${volumeId}, ${m.absPath}, ${m.relPath}, ${m.filename}, ${m.kind}, ${m.ext},
            ${m.sizeBytes}, ${m.mtime.toISOString()}, ${m.signature})
    RETURNING id
  `;
  return { kind: "inserted", id: inserted[0].id };
}

/** Store ffprobe results on an asset. */
export async function setAssetProbe(
  id: number,
  p: { container: string | null; codec: string | null; audioCodec: string | null;
       width: number | null; height: number | null; durationS: number | null; fps: number | null }
): Promise<void> {
  await sql`
    UPDATE assets SET container = ${p.container}, codec = ${p.codec}, audio_codec = ${p.audioCodec},
      width = ${p.width}, height = ${p.height}, duration_s = ${p.durationS}, fps = ${p.fps}
    WHERE id = ${id}
  `;
}

export async function setAssetStatus(id: number, status: AssetRow["status"], error?: string): Promise<void> {
  await sql`UPDATE assets SET status = ${status}, error = ${error ?? null} WHERE id = ${id}`;
}

/** After a crawl pass, flag everything not seen since `since` as missing. */
export async function markMissingSince(volumeId: number, since: Date): Promise<number> {
  const r = await sql<{ id: number }>`
    UPDATE assets SET missing_at = now()
    WHERE volume_id = ${volumeId} AND last_seen_at < ${since.toISOString()} AND missing_at IS NULL
    RETURNING id
  `;
  return r.length;
}

export async function getAsset(id: number): Promise<AssetRow | null> {
  const r = await sql<AssetRow>`SELECT * FROM assets WHERE id = ${id}`;
  return r[0] ?? null;
}

// ── Proxies ─────────────────────────────────────────────────────────────────
export async function upsertProxy(
  assetId: number, kind: ProxyKind,
  fields: { path?: string | null; codec?: string | null; bitrate?: string | null;
            meta?: Record<string, unknown>; status: ProxyRow["status"];
            source?: ProxyRow["source"]; error?: string | null }
): Promise<void> {
  await sql`
    INSERT INTO proxies (asset_id, kind, path, codec, bitrate, meta, status, source, error)
    VALUES (${assetId}, ${kind}, ${fields.path ?? null}, ${fields.codec ?? null}, ${fields.bitrate ?? null},
            ${JSON.stringify(fields.meta ?? {})}, ${fields.status}, ${fields.source ?? "generated"}, ${fields.error ?? null})
    ON CONFLICT (asset_id, kind) DO UPDATE SET
      path = EXCLUDED.path, codec = EXCLUDED.codec, bitrate = EXCLUDED.bitrate,
      meta = EXCLUDED.meta, status = EXCLUDED.status, source = EXCLUDED.source, error = EXCLUDED.error
  `;
}

export async function getProxies(assetId: number): Promise<ProxyRow[]> {
  return sql<ProxyRow>`SELECT * FROM proxies WHERE asset_id = ${assetId}`;
}
export async function getProxy(assetId: number, kind: ProxyKind): Promise<ProxyRow | null> {
  const r = await sql<ProxyRow>`SELECT * FROM proxies WHERE asset_id = ${assetId} AND kind = ${kind}`;
  return r[0] ?? null;
}

// ── Jobs (the queue) ────────────────────────────────────────────────────────
export async function enqueue(
  type: JobType, assetId: number | null, payload: Record<string, unknown> = {}, priority = 100
): Promise<void> {
  // De-dupe: don't pile up identical pending work for the same asset/type.
  await sql`
    INSERT INTO jobs (type, asset_id, payload, priority)
    SELECT ${type}, ${assetId}, ${JSON.stringify(payload)}, ${priority}
    WHERE NOT EXISTS (
      SELECT 1 FROM jobs WHERE type = ${type} AND asset_id IS NOT DISTINCT FROM ${assetId}
        AND state IN ('queued','running')
    )
  `;
}

/** Atomically claim the next queued job (FOR UPDATE SKIP LOCKED). */
export async function claimNext(types: JobType[]): Promise<JobRow | null> {
  const r = await query<JobRow>(
    `UPDATE jobs SET state = 'running', started_at = now(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM jobs WHERE state = 'queued' AND type = ANY($1)
       ORDER BY priority, id FOR UPDATE SKIP LOCKED LIMIT 1
     ) RETURNING *`,
    [types]
  );
  return r[0] ?? null;
}

export async function finishJob(id: number): Promise<void> {
  await sql`UPDATE jobs SET state = 'done', finished_at = now() WHERE id = ${id}`;
}
export async function failJobRow(id: number, error: string, retry: boolean): Promise<void> {
  if (retry) {
    // Back to the queue for another attempt; clear the finish marker.
    await sql`UPDATE jobs SET state = 'queued', error = ${error.slice(0, 1000)}, finished_at = NULL WHERE id = ${id}`;
  } else {
    await sql`UPDATE jobs SET state = 'error', error = ${error.slice(0, 1000)}, finished_at = now() WHERE id = ${id}`;
  }
}

// ── Transcripts (Phase 2 AI layer) ──────────────────────────────────────────
export interface TranscriptSegment { start: number; end: number; text: string }
export async function upsertTranscript(
  assetId: number,
  t: { language: string | null; full_text: string; segments: TranscriptSegment[] }
): Promise<void> {
  await sql`
    INSERT INTO transcripts (asset_id, language, segments, full_text)
    VALUES (${assetId}, ${t.language}, ${JSON.stringify(t.segments)}, ${t.full_text})
    ON CONFLICT (asset_id) DO UPDATE SET
      language = EXCLUDED.language, segments = EXCLUDED.segments, full_text = EXCLUDED.full_text
  `;
}

export async function jobCounts(): Promise<Record<string, number>> {
  const r = await sql<{ state: string; n: string }>`SELECT state, count(*) n FROM jobs GROUP BY state`;
  return Object.fromEntries(r.map((x) => [x.state, Number(x.n)]));
}

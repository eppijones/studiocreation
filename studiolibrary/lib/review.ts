/**
 * Review + collaboration data access: review states, ratings, manual tags,
 * custom fields, timecode annotations (comments + markers), activity history,
 * and subclips. Writes also append to the per-asset activity feed.
 */
import { sql, query } from "./db/client";
import { addEvent } from "./repo";

// ── Review states (configurable workflow) ───────────────────────────────────
export interface ReviewState { key: string; label: string; color: string | null; ord: number; kind: string }
export async function listReviewStates(): Promise<ReviewState[]> {
  return sql<ReviewState>`SELECT * FROM review_states ORDER BY ord`;
}

export async function setReviewState(assetId: number, state: string, actor: string | null): Promise<void> {
  const prev = await sql<{ review_state: string }>`SELECT review_state FROM assets WHERE id = ${assetId}`;
  await sql`
    UPDATE assets SET review_state = ${state}, reviewed_by = ${actor}, reviewed_at = now()
    WHERE id = ${assetId}
  `;
  await addEvent(assetId, actor, "state_change", { from: prev[0]?.review_state ?? null, to: state });
}

export async function setRating(assetId: number, rating: number | null, actor: string | null): Promise<void> {
  const r = rating == null ? null : Math.max(0, Math.min(5, Math.round(rating)));
  await sql`UPDATE assets SET rating = ${r} WHERE id = ${assetId}`;
  await addEvent(assetId, actor, "rating", { rating: r });
}

// ── Manual tags (reuse the `tags` table; manual = no timecode) ──────────────
export async function addTag(assetId: number, label: string, actor: string | null): Promise<void> {
  const clean = label.trim();
  if (!clean) return;
  const exists = await sql`
    SELECT 1 FROM tags WHERE asset_id = ${assetId} AND label = ${clean} AND source = 'manual'`;
  if (exists.length) return;
  await sql`INSERT INTO tags (asset_id, source, label) VALUES (${assetId}, 'manual', ${clean})`;
  await addEvent(assetId, actor, "tag", { add: clean });
}
export async function removeTag(assetId: number, label: string, actor: string | null): Promise<void> {
  await sql`DELETE FROM tags WHERE asset_id = ${assetId} AND label = ${label} AND source = 'manual'`;
  await addEvent(assetId, actor, "tag", { remove: label });
}
/** Tag autocomplete: distinct labels already used across the library. */
export async function tagSuggestions(q: string): Promise<string[]> {
  const r = await sql<{ label: string }>`
    SELECT DISTINCT label FROM tags WHERE label ILIKE ${`%${q}%`} ORDER BY label LIMIT 12`;
  return r.map((x) => x.label);
}

// ── Custom fields ────────────────────────────────────────────────────────────
export interface CustomField {
  key: string; label: string; type: string; options: string[];
  ord: number; use_for_upload: boolean; help: string | null;
}
export async function listCustomFields(): Promise<CustomField[]> {
  return sql<CustomField>`SELECT * FROM custom_fields ORDER BY ord`;
}
export async function setCustomField(assetId: number, key: string, value: unknown, actor: string | null): Promise<void> {
  await sql`UPDATE assets SET custom = jsonb_set(coalesce(custom,'{}'), ${`{${key}}`}, ${JSON.stringify(value)}::jsonb, true) WHERE id = ${assetId}`;
  await addEvent(assetId, actor, "custom_field", { key, value });
}

// ── Annotations: comments + markers ─────────────────────────────────────────
export interface Annotation {
  id: number; asset_id: number; kind: "comment" | "marker"; author: string | null;
  body: string | null; tc_in: number | null; tc_out: number | null; color: string | null;
  resolved: boolean; assigned_to: string | null; parent_id: number | null; created_at: string;
}
export async function listAnnotations(assetId: number): Promise<Annotation[]> {
  return sql<Annotation>`
    SELECT * FROM annotations WHERE asset_id = ${assetId}
    ORDER BY coalesce(tc_in, -1), created_at`;
}
export async function addAnnotation(a: {
  assetId: number; kind?: "comment" | "marker"; author: string | null; body?: string;
  tcIn?: number | null; tcOut?: number | null; color?: string | null;
  assignedTo?: string | null; parentId?: number | null;
}): Promise<Annotation> {
  const r = await sql<Annotation>`
    INSERT INTO annotations (asset_id, kind, author, body, tc_in, tc_out, color, assigned_to, parent_id)
    VALUES (${a.assetId}, ${a.kind ?? "comment"}, ${a.author}, ${a.body ?? null},
            ${a.tcIn ?? null}, ${a.tcOut ?? null}, ${a.color ?? null}, ${a.assignedTo ?? null}, ${a.parentId ?? null})
    RETURNING *`;
  await addEvent(a.assetId, a.author, a.kind === "marker" ? "marker" : "comment",
    { body: (a.body ?? "").slice(0, 120), tc_in: a.tcIn ?? null });
  return r[0];
}
export async function updateAnnotation(
  id: number, fields: { body?: string; tcIn?: number | null; tcOut?: number | null; resolved?: boolean; assignedTo?: string | null }
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (fields.body !== undefined) add("body", fields.body);
  if (fields.tcIn !== undefined) add("tc_in", fields.tcIn);
  if (fields.tcOut !== undefined) add("tc_out", fields.tcOut);
  if (fields.resolved !== undefined) add("resolved", fields.resolved);
  if (fields.assignedTo !== undefined) add("assigned_to", fields.assignedTo);
  if (!sets.length) return;
  vals.push(id);
  await query(`UPDATE annotations SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
}
export async function deleteAnnotation(id: number): Promise<void> {
  await sql`DELETE FROM annotations WHERE id = ${id}`;
}

// ── Activity history ────────────────────────────────────────────────────────
export interface AssetEvent { id: number; asset_id: number; actor: string | null; type: string; payload: Record<string, unknown>; created_at: string }
export async function listEvents(assetId: number, limit = 60): Promise<AssetEvent[]> {
  return sql<AssetEvent>`
    SELECT * FROM asset_events WHERE asset_id = ${assetId} ORDER BY created_at DESC LIMIT ${limit}`;
}

// ── Subclips ────────────────────────────────────────────────────────────────
export interface Subclip { id: number; asset_id: number; name: string | null; tc_in: number; tc_out: number; created_by: string | null; created_at: string }
export async function listSubclips(assetId: number): Promise<Subclip[]> {
  return sql<Subclip>`SELECT * FROM subclips WHERE asset_id = ${assetId} ORDER BY tc_in`;
}
export async function addSubclip(assetId: number, name: string | null, tcIn: number, tcOut: number, by: string | null): Promise<Subclip> {
  const r = await sql<Subclip>`
    INSERT INTO subclips (asset_id, name, tc_in, tc_out, created_by)
    VALUES (${assetId}, ${name}, ${tcIn}, ${tcOut}, ${by}) RETURNING *`;
  await addEvent(assetId, by, "subclip", { name, tc_in: tcIn, tc_out: tcOut });
  return r[0];
}
export async function deleteSubclip(id: number): Promise<void> {
  await sql`DELETE FROM subclips WHERE id = ${id}`;
}

/** Counts of open (unresolved) comments per asset — for grid badges. */
export async function openCommentCounts(assetIds: number[]): Promise<Record<number, number>> {
  if (!assetIds.length) return {};
  const r = await query<{ asset_id: number; n: string }>(
    `SELECT asset_id, count(*) n FROM annotations
     WHERE kind='comment' AND resolved=false AND asset_id = ANY($1) GROUP BY asset_id`,
    [assetIds]
  );
  return Object.fromEntries(r.map((x) => [x.asset_id, Number(x.n)]));
}

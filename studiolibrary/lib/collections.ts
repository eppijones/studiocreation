/**
 * Collections (bundles) + share links. A collection is a reference-only set of
 * assets gathered across folders — never a copy on disk. Share links expose an
 * asset or a collection for external review (expiring, view-limited, revocable).
 */
import { randomBytes } from "node:crypto";
import { sql, query } from "./db/client";
import { searchAssets, type AssetFilters } from "./queries";

export interface Collection {
  id: number; name: string; kind: string; description: string | null;
  cover_asset_id: number | null; created_by: string | null; created_at: string; count?: number;
}

export async function listCollections(): Promise<Collection[]> {
  return sql<Collection>`
    SELECT c.*, count(ci.asset_id)::int AS count
    FROM collections c LEFT JOIN collection_items ci ON ci.collection_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC`;
}

export async function createCollection(name: string, by: string | null, description?: string): Promise<Collection> {
  const r = await sql<Collection>`
    INSERT INTO collections (name, kind, description, created_by)
    VALUES (${name}, 'manual', ${description ?? null}, ${by}) RETURNING *`;
  return r[0];
}

/** A smart collection stores a saved query (filters) and resolves live — its
 *  membership auto-updates as footage is ingested/re-reviewed. */
export async function createSmartCollection(
  name: string, by: string | null, filters: AssetFilters, description?: string
): Promise<Collection> {
  const r = await sql<Collection>`
    INSERT INTO collections (name, kind, description, query, created_by)
    VALUES (${name}, 'smart', ${description ?? null}, ${JSON.stringify(filters)}, ${by}) RETURNING *`;
  return r[0];
}

export async function deleteCollection(id: number): Promise<void> {
  await sql`DELETE FROM collections WHERE id = ${id}`;
}

export async function renameCollection(id: number, name: string): Promise<void> {
  await sql`UPDATE collections SET name = ${name} WHERE id = ${id}`;
}

/** Add assets to a collection (idempotent), appended after the current max order. */
export async function addToCollection(collectionId: number, assetIds: number[]): Promise<number> {
  if (!assetIds.length) return 0;
  const max = await sql<{ m: number | null }>`
    SELECT max(ord) m FROM collection_items WHERE collection_id = ${collectionId}`;
  let ord = (max[0]?.m ?? -1) + 1;
  let added = 0;
  for (const aid of assetIds) {
    const r = await sql`
      INSERT INTO collection_items (collection_id, asset_id, ord)
      VALUES (${collectionId}, ${aid}, ${ord})
      ON CONFLICT (collection_id, asset_id) DO NOTHING RETURNING asset_id`;
    if (r.length) { ord++; added++; }
  }
  // First asset becomes the cover if none set.
  await sql`
    UPDATE collections SET cover_asset_id = ${assetIds[0]}
    WHERE id = ${collectionId} AND cover_asset_id IS NULL`;
  return added;
}

export async function removeFromCollection(collectionId: number, assetId: number): Promise<void> {
  await sql`DELETE FROM collection_items WHERE collection_id = ${collectionId} AND asset_id = ${assetId}`;
}

export async function reorderCollection(collectionId: number, orderedAssetIds: number[]): Promise<void> {
  for (let i = 0; i < orderedAssetIds.length; i++) {
    await sql`
      UPDATE collection_items SET ord = ${i}
      WHERE collection_id = ${collectionId} AND asset_id = ${orderedAssetIds[i]}`;
  }
}

/** Collection with its asset rows. Smart collections resolve live from their
 *  saved query; manual collections read their ordered membership. */
export async function getCollection(id: number): Promise<{ collection: Collection; assets: Record<string, unknown>[] } | null> {
  const c = await sql<Collection & { query: AssetFilters | null }>`SELECT * FROM collections WHERE id = ${id}`;
  if (!c[0]) return null;

  if (c[0].kind === "smart" && c[0].query) {
    const assets = await searchAssets(c[0].query);
    return { collection: c[0], assets: assets as unknown as Record<string, unknown>[] };
  }

  const assets = await query<Record<string, unknown>>(
    `SELECT a.*, ci.ord FROM collection_items ci
     JOIN assets a ON a.id = ci.asset_id
     WHERE ci.collection_id = $1 ORDER BY ci.ord, ci.added_at`,
    [id]
  );
  return { collection: c[0], assets };
}

// ── Share links ─────────────────────────────────────────────────────────────
export interface ShareLink {
  id: number; token: string; target_type: "asset" | "collection"; target_id: number;
  mode: string; allow_comments: boolean; allow_download: boolean; embed: string;
  recipient: string | null; expires_at: string | null; view_limit: number | null;
  views_used: number; revoked: boolean; created_by: string | null; created_at: string;
}

export async function createShareLink(input: {
  targetType: "asset" | "collection"; targetId: number; mode?: string;
  allowComments?: boolean; allowDownload?: boolean; embed?: string;
  recipient?: string | null; expiresInDays?: number | null; viewLimit?: number | null; by: string | null;
}): Promise<ShareLink> {
  const token = randomBytes(12).toString("base64url");
  const expires =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400_000).toISOString()
      : null;
  const r = await sql<ShareLink>`
    INSERT INTO share_links (token, target_type, target_id, mode, allow_comments, allow_download, embed, recipient, expires_at, view_limit, created_by)
    VALUES (${token}, ${input.targetType}, ${input.targetId}, ${input.mode ?? "anonymous"},
            ${input.allowComments ?? true}, ${input.allowDownload ?? false}, ${input.embed ?? "full"},
            ${input.recipient ?? null}, ${expires}, ${input.viewLimit ?? null}, ${input.by})
    RETURNING *`;
  return r[0];
}

export async function listShareLinks(targetType: "asset" | "collection", targetId: number): Promise<ShareLink[]> {
  return sql<ShareLink>`
    SELECT * FROM share_links WHERE target_type = ${targetType} AND target_id = ${targetId}
    ORDER BY created_at DESC`;
}

export async function revokeShareLink(id: number): Promise<void> {
  await sql`UPDATE share_links SET revoked = true WHERE id = ${id}`;
}

/** Validate a token WITHOUT bumping the view counter (media/asset checks). */
export async function peekShareToken(token: string): Promise<ShareLink | null> {
  const r = await sql<ShareLink>`SELECT * FROM share_links WHERE token = ${token}`;
  const link = r[0];
  if (!link || link.revoked) return null;
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return null;
  if (link.view_limit != null && link.views_used >= link.view_limit) return null;
  return link;
}

/** Validate a token AND bump the view counter (called once per page open). */
export async function consumeShareToken(token: string): Promise<ShareLink | null> {
  const link = await peekShareToken(token);
  if (!link) return null;
  await sql`UPDATE share_links SET views_used = views_used + 1 WHERE id = ${link.id}`;
  return link;
}

/** The asset ids a link grants access to (the asset itself, or a collection's). */
export async function shareAssetIds(link: ShareLink): Promise<number[]> {
  if (link.target_type === "asset") return [link.target_id];
  const r = await sql<{ asset_id: number }>`
    SELECT asset_id FROM collection_items WHERE collection_id = ${link.target_id}`;
  return r.map((x) => x.asset_id);
}

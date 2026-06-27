/**
 * Soft presence — "who's viewing this asset". Heartbeat upsert from the review
 * tool; viewers() filters by recency (no cleanup job, no websocket server).
 */
import { sql } from "./db/client";

export async function heartbeat(assetId: number, userId: number, name: string): Promise<void> {
  await sql`
    INSERT INTO presence (asset_id, user_id, user_name, seen_at)
    VALUES (${assetId}, ${userId}, ${name}, now())
    ON CONFLICT (asset_id, user_id) DO UPDATE SET seen_at = now(), user_name = EXCLUDED.user_name
  `;
}

export interface Viewer { user_id: number; user_name: string }

/** Live viewers of an asset (seen within `withinS` seconds). */
export async function viewers(assetId: number, withinS = 30): Promise<Viewer[]> {
  return sql<Viewer>`
    SELECT user_id, user_name FROM presence
    WHERE asset_id = ${assetId} AND seen_at > now() - (${withinS} * interval '1 second')
    ORDER BY seen_at DESC`;
}

/** Drop my heartbeat (on leaving the asset view). */
export async function clearPresence(assetId: number, userId: number): Promise<void> {
  await sql`DELETE FROM presence WHERE asset_id = ${assetId} AND user_id = ${userId}`;
}

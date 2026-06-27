/**
 * Read-through mirror of Neon's canonical users into the Media Library DB.
 * The library's own `users` table is keyed by the SAME id as Neon, so library
 * rows (annotations.author_id, asset_events.actor_id, …) can join locally
 * without reaching across to Neon on every query. The library NEVER writes back
 * — this is the only writer, called from the Node /api/users routes.
 *
 * The library role enum is admin/editor/guest; map the canonical StudioRole onto
 * it so the library's existing gating keeps working.
 */
import { sql } from "./db/client";

export type StudioRole = "creative" | "producer" | "finance" | "admin";
type LibraryRole = "admin" | "editor" | "guest";

export function toLibraryRole(role: StudioRole): LibraryRole {
  if (role === "admin") return "admin";
  if (role === "producer" || role === "finance") return "editor";
  return "guest";
}

export interface MirrorUser {
  id: number; name: string; email: string | null; handle: string | null;
  role: StudioRole; avatarUrl: string | null; active: boolean;
}

/** Upsert one user into the library mirror (by canonical id). */
export async function mirrorUser(u: MirrorUser): Promise<void> {
  await sql`
    INSERT INTO users (id, name, email, handle, role, avatar_url, active)
    VALUES (${u.id}, ${u.name}, ${u.email}, ${u.handle}, ${toLibraryRole(u.role)}, ${u.avatarUrl}, ${u.active})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, email = EXCLUDED.email, handle = EXCLUDED.handle,
      role = EXCLUDED.role, avatar_url = EXCLUDED.avatar_url, active = EXCLUDED.active
  `;
}

/** Mirror a canonical Neon user row, swallowing failures so a mirror outage
 *  (e.g. library DB unreachable from a serverless function) never breaks user
 *  management. */
export async function safeMirrorUser(u: {
  id: number; name: string; email: string; handle: string;
  role: StudioRole; avatar_url: string | null; active: boolean;
}): Promise<void> {
  try {
    await mirrorUser({
      id: u.id, name: u.name, email: u.email, handle: u.handle,
      role: u.role, avatarUrl: u.avatar_url, active: u.active,
    });
  } catch (e) {
    console.warn(`⚠ user mirror skipped (library DB unreachable?): ${(e as Error).message}`);
  }
}

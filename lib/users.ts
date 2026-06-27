/**
 * Canonical user accounts — live in Neon (`DATABASE_URL`), the only DB the edge
 * middleware can reach. The Media Library `users` table is a read-through mirror
 * of these rows (studiolibrary/lib/users-mirror.ts). NODE-ONLY.
 */
import { sql } from "./db";
import { headers } from "next/headers";
import { hashPassword } from "./password";
import { parseRole, UID_HEADER, type StudioRole } from "./auth";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  handle: string;
  role: StudioRole;
  avatar_url: string | null;
  active: boolean;
  token_version: number;
  last_login_at: string | null;
  created_at: string;
}

/** Slugify a display name into a unique-ish mention handle ("Maya Ortiz" → "maya-ortiz"). */
export function handleFromName(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "user";
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const r = await sql`
    SELECT id, email, name, handle, role, avatar_url, active, token_version, last_login_at, created_at
    FROM users WHERE id = ${id}`;
  return (r[0] as UserRow) ?? null;
}

export async function getUserByEmail(
  email: string
): Promise<(UserRow & { password_hash: string | null }) | null> {
  const r = await sql`
    SELECT id, email, name, handle, role, avatar_url, active, token_version, last_login_at, created_at,
           password_hash
    FROM users WHERE lower(email) = lower(${email})`;
  return (r[0] as UserRow & { password_hash: string | null }) ?? null;
}

export async function getUserByHandle(handle: string): Promise<UserRow | null> {
  const r = await sql`
    SELECT id, email, name, handle, role, avatar_url, active, token_version, last_login_at, created_at
    FROM users WHERE lower(handle) = lower(${handle})`;
  return (r[0] as UserRow) ?? null;
}

export async function listUsers(): Promise<UserRow[]> {
  const r = await sql`
    SELECT id, email, name, handle, role, avatar_url, active, token_version, last_login_at, created_at
    FROM users ORDER BY active DESC, name`;
  return r as UserRow[];
}

/** Ensure a handle is unique by suffixing a counter when needed. */
async function uniqueHandle(seed: string): Promise<string> {
  let handle = seed;
  for (let n = 2; n < 1000; n++) {
    const existing = await sql`SELECT 1 FROM users WHERE handle = ${handle}`;
    if (!existing.length) return handle;
    handle = `${seed}-${n}`;
  }
  return `${seed}-${Date.now()}`;
}

export async function createUser(input: {
  email: string; name: string; role: StudioRole; password: string;
  handle?: string; avatarUrl?: string | null;
}): Promise<UserRow> {
  const handle = await uniqueHandle(input.handle?.trim() || handleFromName(input.name));
  const r = await sql`
    INSERT INTO users (email, name, handle, role, password_hash, avatar_url)
    VALUES (${input.email.trim()}, ${input.name.trim()}, ${handle}, ${parseRole(input.role)},
            ${hashPassword(input.password)}, ${input.avatarUrl ?? null})
    RETURNING id, email, name, handle, role, avatar_url, active, token_version, last_login_at, created_at`;
  return r[0] as UserRow;
}

export async function setUserActive(id: number, active: boolean): Promise<void> {
  // Deactivating also revokes outstanding sessions (token_version bump).
  await sql`
    UPDATE users SET active = ${active}, token_version = token_version + ${active ? 0 : 1}
    WHERE id = ${id}`;
}

export async function setUserRole(id: number, role: StudioRole): Promise<void> {
  await sql`UPDATE users SET role = ${parseRole(role)} WHERE id = ${id}`;
}

export async function setUserPassword(id: number, password: string): Promise<void> {
  // Changing a password logs out other sessions.
  await sql`
    UPDATE users SET password_hash = ${hashPassword(password)}, token_version = token_version + 1
    WHERE id = ${id}`;
}

export async function bumpTokenVersion(id: number): Promise<void> {
  await sql`UPDATE users SET token_version = token_version + 1 WHERE id = ${id}`;
}

export async function touchLogin(id: number): Promise<void> {
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${id}`;
}

/** The user behind the current request — resolved from the edge-verified
 *  `x-studio-uid` header. Returns null in shared-password (legacy) mode. Also
 *  enforces the authoritative `active` + `token_version` check the edge can't. */
export async function currentUser(): Promise<UserRow | null> {
  const h = await headers();
  const uid = Number(h.get(UID_HEADER));
  if (!Number.isInteger(uid) || uid <= 0) return null;
  const user = await getUserById(uid);
  if (!user || !user.active) return null;
  return user;
}

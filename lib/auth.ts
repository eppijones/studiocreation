/**
 * Shared-password session cookie, HMAC-signed with STUDIO_PASSWORD.
 * Edge-compatible (Web Crypto only) — used by middleware and the login route.
 */

export const SESSION_COOKIE = "studio_session";
export const OPERATOR_COOKIE = "studio_operator";
export const ROLE_COOKIE = "studio_role";

export type StudioRole = "creative" | "producer" | "finance" | "admin";
export const ROLES: StudioRole[] = ["creative", "producer", "finance", "admin"];
/** Roles allowed to change budget governance settings. */
export const GOVERNOR_ROLES: StudioRole[] = ["finance", "admin"];

export function parseRole(value: string | undefined): StudioRole {
  return ROLES.includes(value as StudioRole) ? (value as StudioRole) : "creative";
}

const SESSION_PAYLOAD = "studiocreation-v1";
/** Sessions are valid for 30 days from issue; after that the operator re-signs in. */
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token = `<issuedAtMs>.<hmac(password, payload.iat)>` — the timestamp is signed,
 *  so it can't be forged, and it lets us expire stale sessions. */
export async function createSessionToken(password: string, issuedAtMs: number = Date.now()): Promise<string> {
  const sig = await hmacHex(password, `${SESSION_PAYLOAD}.${issuedAtMs}`);
  return `${issuedAtMs}.${sig}`;
}

export async function verifySessionToken(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const issuedAtMs = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(issuedAtMs)) return false;
  // Reject future-dated and expired tokens (small clock-skew grace).
  const age = Date.now() - issuedAtMs;
  if (age > SESSION_MAX_AGE_MS || age < -60_000) return false;
  const expected = await hmacHex(password, `${SESSION_PAYLOAD}.${issuedAtMs}`);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

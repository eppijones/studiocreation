/**
 * Shared-password session cookie, HMAC-signed with STUDIO_PASSWORD.
 * Edge-compatible (Web Crypto only) — used by middleware and the login route.
 */

export const SESSION_COOKIE = "studio_session";
export const OPERATOR_COOKIE = "studio_operator";
export const ROLE_COOKIE = "studio_role";

/** Edge-verified identity, handed to node routes via request headers so they
 *  never re-verify the token. Set by middleware on a valid per-user session. */
export const UID_HEADER = "x-studio-uid";
export const ROLE_HEADER = "x-studio-role";

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

// ── Per-user sessions (Phase 0) ──────────────────────────────────────────────
// Identity-carrying token, signed with a server SESSION_SECRET (NOT a user
// password). Stays edge-compatible: Web Crypto + base64url only, no DB call.
// The token is stateless; `tv` (= users.token_version) is the revocation lever
// that node routes check against the DB. The edge only guards forged/expired.

export interface SessionClaims {
  uid: number;        // users.id
  role: StudioRole;
  tv: number;         // users.token_version at issue time
  iat: number;        // issued-at ms (signed → can't be forged)
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Token = `<b64url(JSON(claims))>.<hmac(secret, payload)>`. */
export async function createUserSessionToken(
  claims: Omit<SessionClaims, "iat"> & { iat?: number },
  secret: string
): Promise<string> {
  const full: SessionClaims = { ...claims, iat: claims.iat ?? Date.now() };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(full)));
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

/** Verify signature + expiry; return the claims, or null if invalid. */
export async function verifyUserSessionToken(
  token: string | undefined,
  secret: string
): Promise<SessionClaims | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(secret, payload);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
  if (typeof claims.iat !== "number" || !Number.isFinite(claims.iat)) return null;
  const age = Date.now() - claims.iat;
  if (age > SESSION_MAX_AGE_MS || age < -60_000) return null;
  if (typeof claims.uid !== "number") return null;
  claims.role = parseRole(claims.role);
  return claims;
}

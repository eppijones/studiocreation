/**
 * Shared-password session cookie, HMAC-signed with STUDIO_PASSWORD.
 * Edge-compatible (Web Crypto only) — used by middleware and the login route.
 */

export const SESSION_COOKIE = "studio_session";
export const OPERATOR_COOKIE = "studio_operator";

const SESSION_PAYLOAD = "studiocreation-v1";

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

export async function createSessionToken(password: string): Promise<string> {
  return hmacHex(password, SESSION_PAYLOAD);
}

export async function verifySessionToken(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const expected = await hmacHex(password, SESSION_PAYLOAD);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

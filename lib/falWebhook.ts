/**
 * fal queue webhook signature verification (ED25519 over JWKS).
 * https://docs.fal.ai/model-endpoints/webhooks
 */

const JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";
const TIMESTAMP_TOLERANCE_S = 300;

let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

async function getJwks(): Promise<JsonWebKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 10 * 60 * 1000) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as { keys: JsonWebKey[] };
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyFalWebhook(request: Request, rawBody: ArrayBuffer): Promise<boolean> {
  const requestId = request.headers.get("x-fal-webhook-request-id");
  const userId = request.headers.get("x-fal-webhook-user-id");
  const timestamp = request.headers.get("x-fal-webhook-timestamp");
  const signature = request.headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TIMESTAMP_TOLERANCE_S) return false;

  const bodyHash = await crypto.subtle.digest("SHA-256", rawBody);
  const bodyHashHex = Array.from(new Uint8Array(bodyHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const message = new TextEncoder().encode(
    [requestId, userId, timestamp, bodyHashHex].join("\n")
  );
  const sigBytes = hexToBytes(signature);

  try {
    const keys = await getJwks();
    for (const jwk of keys) {
      try {
        const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
          "verify",
        ]);
        if (await crypto.subtle.verify("Ed25519", key, sigBytes as BufferSource, message)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Password hashing — scrypt via node:crypto (stdlib, no native dep so it builds
 * cleanly on the Mac/WSL2 worker box). NODE-ONLY: never import from middleware
 * or a client bundle. Used by the login + admin routes (nodejs runtime).
 *
 * Stored format: `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384; // CPU/memory cost
const R = 8;
const P = 1;
const KEYLEN = 32;

if (typeof window !== "undefined") {
  throw new Error("lib/password.ts imported in a client bundle");
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(plain, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Sampled content signature — size + mtime + head/tail hash.
 *
 * Deliberately NOT a full-file hash: masters are huge (multi-GB MXF) and live
 * on a network share in prod; hashing every byte of 120TB is a non-starter.
 * Head+tail+size catches edits/transcodes in practice, and lets reconcile
 * detect a MOVE (same signature, new path) vs a genuinely new file.
 */
import { createHash } from "node:crypto";
import type { Volume } from "../volumes/types";

const SAMPLE = 64 * 1024; // 64KB from head and tail

export async function computeSignature(
  volume: Volume,
  relPath: string,
  sizeBytes: number,
  mtime: Date
): Promise<string> {
  const h = createHash("sha1");
  h.update(`${sizeBytes}:${mtime.getTime()}:`);
  try {
    const head = await volume.readBytes(relPath, 0, Math.min(SAMPLE, sizeBytes));
    h.update(head);
    if (sizeBytes > SAMPLE) {
      const tailStart = Math.max(SAMPLE, sizeBytes - SAMPLE);
      const tail = await volume.readBytes(relPath, tailStart, sizeBytes);
      h.update(tail);
    }
  } catch {
    // Unreadable bytes — fall back to size+mtime only (already mixed in).
  }
  return h.digest("hex");
}

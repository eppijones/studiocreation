/**
 * Embedding step — runs local CLIP (open_clip) over an asset's frames and its
 * transcript chunks, stores vectors in the pgvector `embeddings` table. Mirrors
 * transcribe.ts: spawns a Python process in the shared venv that emits one JSON
 * line. Local + offline. "cuda" in Oslo.
 */
import { spawn } from "node:child_process";
import { EMBED } from "./config/index";
import { sql, query } from "./db/client";
import type { AssetRow } from "./repo";
import type { Volume } from "./volumes/types";

export interface EmbedItem { timecode_s: number | null; vector: number[] }
interface EmbedOut { dim?: number; items?: EmbedItem[]; vector?: number[]; error?: string }

function runEmbed(args: string[], stdin?: string): Promise<EmbedOut> {
  return new Promise((resolve) => {
    const p = spawn(EMBED.python, [EMBED.script, ...args]);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => resolve({ error: `spawn failed: ${e.message}` }));
    p.on("close", () => {
      try {
        resolve(JSON.parse(stdout.trim().split("\n").pop() || "{}"));
      } catch {
        resolve({ error: `unparseable output: ${stderr.slice(-400) || stdout.slice(-400)}` });
      }
    });
    if (stdin != null) { p.stdin.write(stdin); p.stdin.end(); }
  });
}

/** Embed an asset's frames (video sampled every ~2s; image = one frame). */
export async function embedAssetFrames(asset: AssetRow, volume: Volume): Promise<EmbedItem[]> {
  if (asset.kind !== "video" && asset.kind !== "image") return [];
  const src = volume.absPath(asset.rel_path);
  const out = await runEmbed(["frames", src, EMBED.device]);
  if (out.error) throw new Error(out.error);
  return out.items ?? [];
}

/** Embed an asset's transcript in ~1-2 sentence windows (timecode-anchored). */
export async function embedAssetTranscript(asset: AssetRow): Promise<EmbedItem[]> {
  const rows = await sql<{ segments: { start: number; text: string }[] }>`
    SELECT segments FROM transcripts WHERE asset_id = ${asset.id}`;
  const segs = rows[0]?.segments ?? [];
  if (!segs.length) return [];
  // Window 2 segments per chunk to give the text encoder some context.
  const chunks: { timecode_s: number; text: string }[] = [];
  for (let i = 0; i < segs.length; i += 2) {
    const window = segs.slice(i, i + 2);
    const text = window.map((s) => s.text.trim()).filter(Boolean).join(" ");
    if (text) chunks.push({ timecode_s: window[0].start, text });
  }
  if (!chunks.length) return [];
  const out = await runEmbed(["text", EMBED.device], JSON.stringify({ chunks }));
  if (out.error) throw new Error(out.error);
  return out.items ?? [];
}

/** Encode a search query string into one vector (for text→vector search). */
export async function embedQuery(text: string): Promise<number[]> {
  const out = await runEmbed(["query", text, EMBED.device]);
  if (out.error) throw new Error(out.error);
  return out.vector ?? [];
}

/** pgvector literal: [0.1,0.2,...]. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Replace an asset's embeddings for a modality (delete-then-insert). */
export async function storeEmbeddings(
  assetId: number, modality: "frame" | "transcript", items: EmbedItem[]
): Promise<void> {
  await sql`DELETE FROM embeddings WHERE asset_id = ${assetId} AND modality = ${modality}`;
  for (const it of items) {
    if (!it.vector?.length) continue;
    await query(
      `INSERT INTO embeddings (asset_id, modality, timecode_s, dim, vector) VALUES ($1, $2, $3, $4, $5)`,
      [assetId, modality, it.timecode_s, it.vector.length, toVectorLiteral(it.vector)]
    );
  }
}

/** Embed everything available for an asset (frames + transcript). Returns count. */
export async function embedAsset(asset: AssetRow, volume: Volume): Promise<number> {
  let n = 0;
  if (asset.kind === "video" || asset.kind === "image") {
    const frames = await embedAssetFrames(asset, volume);
    if (frames.length) { await storeEmbeddings(asset.id, "frame", frames); n += frames.length; }
  }
  if (asset.kind === "video" || asset.kind === "audio") {
    const tx = await embedAssetTranscript(asset);
    if (tx.length) { await storeEmbeddings(asset.id, "transcript", tx); n += tx.length; }
  }
  return n;
}

/**
 * Crawler / indexer. Walks a read-only Volume, records each file's identity
 * (path, size, mtime, sampled signature) and technical metadata (ffprobe),
 * and reconciles new / moved / deleted idempotently. Enqueues a proxy job for
 * every new or content-changed asset. Append-only ingest manifest for audit.
 *
 * NEVER moves, renames or deletes source files — the filesystem is the source
 * of truth and the index is disposable.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { Volume } from "./volumes/types";
import { kindForExt, extOf, INGEST_MANIFEST } from "./config/index";
import { computeSignature } from "./media/signature";
import { ffprobe } from "./media/ffprobe";
import {
  getVolumeByName, upsertDiscovered, setAssetProbe, markMissingSince, enqueue,
} from "./repo";
import { fireEvent } from "./automation";

export interface CrawlStats {
  scanned: number;
  inserted: number;
  changed: number;
  moved: number;
  unchanged: number;
  missing: number;
  enqueued: number;
}

async function appendManifest(event: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(dirname(INGEST_MANIFEST), { recursive: true });
    await appendFile(INGEST_MANIFEST, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  } catch {
    /* manifest is best-effort audit, never blocks the crawl */
  }
}

export async function crawlVolume(volume: Volume): Promise<CrawlStats> {
  const volRow = await getVolumeByName(volume.name);
  if (!volRow) throw new Error(`volume "${volume.name}" not in DB — run library:migrate first`);

  const stats: CrawlStats = {
    scanned: 0, inserted: 0, changed: 0, moved: 0, unchanged: 0, missing: 0, enqueued: 0,
  };
  const crawlStart = new Date();

  for await (const f of volume.walk()) {
    const kind = kindForExt(f.ext);
    if (!kind) continue;
    stats.scanned++;

    const signature = await computeSignature(volume, f.relPath, f.sizeBytes, f.mtime);
    const outcome = await upsertDiscovered(volRow.id, {
      relPath: f.relPath, absPath: f.absPath, filename: f.filename, ext: f.ext,
      kind, sizeBytes: f.sizeBytes, mtime: f.mtime, signature,
    });

    if (outcome.kind === "inserted" || outcome.kind === "changed") {
      // Probe technical metadata now (fast on local; deferred kinds skip cleanly).
      if (kind === "video" || kind === "audio" || kind === "image") {
        const probe = await ffprobe(f.absPath);
        await setAssetProbe(outcome.id, probe);
      }
      // Automation drives the pipeline: the "Proxy new footage" rule enqueues
      // the proxy step. Fall back to a direct enqueue if no rule fired (so an
      // empty/disabled ruleset never silently stops processing).
      let fired = 0;
      try {
        fired = await fireEvent("asset.created", { assetId: outcome.id, kind, relPath: f.relPath });
      } catch (e) {
        await appendManifest({ event: "automation_error", asset_id: outcome.id, error: (e as Error).message });
      }
      if (fired === 0) await enqueue("proxy", outcome.id, { kind }, kind === "video" ? 100 : 50);
      stats.enqueued++;
      stats[outcome.kind === "inserted" ? "inserted" : "changed"]++;
      await appendManifest({ event: outcome.kind, asset_id: outcome.id, rel_path: f.relPath, kind });
    } else if (outcome.kind === "moved") {
      stats.moved++;
      await appendManifest({ event: "moved", asset_id: outcome.id, from: outcome.from, to: f.absPath });
    } else {
      stats.unchanged++;
    }
  }

  stats.missing = await markMissingSince(volRow.id, crawlStart);
  if (stats.missing) await appendManifest({ event: "missing", volume: volume.name, count: stats.missing });

  return stats;
}

/**
 * Index a SINGLE file (just-uploaded or just-added) — same identity + probe +
 * automation-fire path as a full crawl, scoped to one path. Returns the asset
 * id, or null if the path isn't an indexable kind / can't be read.
 */
export async function ingestFile(volume: Volume, relPath: string): Promise<{ id: number; kind: string } | null> {
  const ext = extOf(relPath);
  const kind = kindForExt(ext);
  if (!kind) return null;
  const st = await volume.stat(relPath);
  if (!st) return null;

  const volRow = await getVolumeByName(volume.name);
  if (!volRow) throw new Error(`volume "${volume.name}" not in DB`);

  const signature = await computeSignature(volume, relPath, st.sizeBytes, st.mtime);
  const outcome = await upsertDiscovered(volRow.id, {
    relPath, absPath: volume.absPath(relPath), filename: basename(relPath), ext,
    kind, sizeBytes: st.sizeBytes, mtime: st.mtime, signature,
  });

  if (outcome.kind === "inserted" || outcome.kind === "changed") {
    if (kind === "video" || kind === "audio" || kind === "image") {
      await setAssetProbe(outcome.id, await ffprobe(volume.absPath(relPath)));
    }
    let fired = 0;
    try {
      fired = await fireEvent("asset.created", { assetId: outcome.id, kind, relPath });
    } catch { /* automation best-effort */ }
    if (fired === 0) await enqueue("proxy", outcome.id, { kind }, kind === "video" ? 100 : 50);
    await appendManifest({ event: "upload", asset_id: outcome.id, rel_path: relPath, kind });
  }
  return { id: outcome.id, kind };
}

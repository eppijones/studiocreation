/**
 * StudioLibrary worker — the long-running on-prem engine. Crawls the volume(s)
 * and drains the job queue (proxy now; transcribe/tag/embed in Phase 2) with
 * bounded concurrency. CANNOT run on Vercel serverless — localhost now, WSL2
 * in Oslo.
 *
 *   pnpm library:crawl     # one crawl pass, then exit
 *   pnpm library:work      # process the queue forever
 *   pnpm library:once      # crawl + drain the queue, then exit (smoke tests)
 */
import { configuredVolumes, makeVolume } from "../lib/volumes/index";
import type { Volume } from "../lib/volumes/types";
import {
  listVolumes, claimNext, finishJob, failJobRow, getAsset, enqueue, jobCounts,
  setAssetStatus, type JobRow,
} from "../lib/repo";
import { crawlVolume } from "../lib/crawler";
import { processAsset } from "../lib/proxy";
import { transcribeAsset } from "../lib/transcribe";
import { embedAsset } from "../lib/embed";
import { dueScheduledRules, runRuleManually } from "../lib/automation";
import { encoder } from "../lib/encoders/index";
import { QUEUE_CONCURRENCY, LIBRARY_ENCODER } from "../lib/config/index";
import { pool } from "../lib/db/client";

const MAX_ATTEMPTS = 3;

async function volumeMap(): Promise<Map<number, Volume>> {
  const rows = await listVolumes();
  const map = new Map<number, Volume>();
  for (const v of rows) {
    try {
      map.set(v.id, makeVolume({ name: v.name, kind: v.kind, root: v.root, readOnly: v.read_only }));
    } catch (e) {
      // e.g. SMBVolume refusing to construct in Phase 0 — skip, don't crash.
      console.warn(`   ⚠ volume "${v.name}" unavailable: ${(e as Error).message}`);
    }
  }
  return map;
}

export async function runCrawl(): Promise<void> {
  console.log(`🔎 crawling (encoder=${LIBRARY_ENCODER})`);
  for (const { volume } of configuredVolumes()) {
    const s = await crawlVolume(volume);
    console.log(
      `   • ${volume.name}: scanned=${s.scanned} new=${s.inserted} changed=${s.changed} ` +
        `moved=${s.moved} missing=${s.missing} → enqueued ${s.enqueued} proxy jobs`
    );
  }
}

async function processOne(job: JobRow, vols: Map<number, Volume>): Promise<void> {
  // index/tag aren't implemented yet — mark done so they don't wedge.
  if (job.type !== "proxy" && job.type !== "transcribe" && job.type !== "embed") {
    await finishJob(job.id);
    return;
  }
  const asset = job.asset_id != null ? await getAsset(job.asset_id) : null;
  if (!asset) {
    await failJobRow(job.id, "asset row missing", false);
    return;
  }
  const volume = vols.get(asset.volume_id);
  if (!volume) {
    await failJobRow(job.id, `no live adapter for volume ${asset.volume_id}`, job.attempts < MAX_ATTEMPTS);
    return;
  }
  try {
    if (job.type === "proxy") {
      const ok = await processAsset(asset, volume);
      // Chain transcription for anything with an audio track (Phase 2 AI layer).
      if (ok && (asset.kind === "audio" || (asset.kind === "video" && asset.audio_codec))) {
        await enqueue("transcribe", asset.id, {}, 200);
      }
      // Chain frame embedding for visual assets without a transcript step
      // (images, and videos with no audio track). Audio/voiced video embed
      // after transcribe so the transcript is embedded too.
      if (ok && (asset.kind === "image" || (asset.kind === "video" && !asset.audio_codec))) {
        await enqueue("embed", asset.id, {}, 250);
      }
      console.log(`   ${ok ? "✓" : "⚠"} proxy #${asset.id} ${asset.kind} ${asset.rel_path}${ok ? "" : " (no derivative)"}`);
    } else if (job.type === "transcribe") {
      const ok = await transcribeAsset(asset, volume);
      // Now that the transcript exists, embed frames + transcript chunks.
      await enqueue("embed", asset.id, {}, 250);
      console.log(`   ✎ transcript #${asset.id} ${asset.rel_path}${ok ? "" : " (no speech detected)"}`);
    } else {
      // embed: CLIP frame + transcript vectors → pgvector (semantic search).
      const n = await embedAsset(asset, volume);
      await setAssetStatus(asset.id, "enriched");
      console.log(`   ⊹ embed #${asset.id} ${asset.rel_path} (${n} vectors)`);
    }
    await finishJob(job.id);
  } catch (e) {
    const retry = job.attempts < MAX_ATTEMPTS;
    await failJobRow(job.id, (e as Error).message, retry);
    console.warn(`   ✗ ${job.type} #${asset.id} (${retry ? "will retry" : "gave up"}): ${(e as Error).message}`);
  }
}

/** Drain the queue with bounded concurrency. `once` exits when fully idle. */
export async function work(opts: { once: boolean }): Promise<void> {
  const ok = await encoder.available();
  console.log(`⚙️  worker up — encoder=${encoder.id} available=${ok} concurrency=${QUEUE_CONCURRENCY.proxy}`);
  const vols = await volumeMap();
  const inflight = new Set<Promise<void>>();
  let idleTicks = 0;
  let lastSchedMin = -1;

  for (;;) {
    while (inflight.size < QUEUE_CONCURRENCY.proxy) {
      const job = await claimNext(["proxy", "index", "transcribe", "tag", "embed"]);
      if (!job) break;
      idleTicks = 0;
      const p = processOne(job, vols).finally(() => inflight.delete(p));
      inflight.add(p);
    }
    if (inflight.size > 0) {
      await Promise.race(inflight);
      continue;
    }
    // Continuous mode: once a minute, fire any scheduled automation rules whose
    // cron matches now (e.g. nightly rescan / re-transcode).
    if (!opts.once) {
      const now = new Date();
      if (now.getMinutes() !== lastSchedMin) {
        lastSchedMin = now.getMinutes();
        try {
          const due = await dueScheduledRules(now);
          for (const rule of due) {
            const wantsRescan = rule.steps.some((s) => s.action === "rescan");
            if (wantsRescan) await runCrawl();
            await runRuleManually(rule.id, []);
            console.log(`   ⏰ scheduled rule "${rule.name}" ran`);
          }
        } catch (e) {
          console.warn(`   scheduler error: ${(e as Error).message}`);
        }
      }
    }
    // Queue empty and nothing in flight.
    if (opts.once) {
      idleTicks++;
      if (idleTicks >= 2) break; // two clean passes → truly drained
    }
    await new Promise((r) => setTimeout(r, opts.once ? 150 : 1000));
  }
  const counts = await jobCounts();
  console.log(`✅ queue drained: ${JSON.stringify(counts)}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "all";
  if (mode === "crawl") {
    await runCrawl();
  } else if (mode === "work") {
    await work({ once: false });
  } else if (mode === "once") {
    await runCrawl();
    await work({ once: true });
  } else {
    // default: crawl once, then keep working
    await runCrawl();
    await work({ once: false });
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("worker error:", e);
    await pool.end().catch(() => {});
    process.exit(1);
  });

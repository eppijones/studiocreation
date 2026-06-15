import { sql, type JobRow } from "./db";
import { falProvider } from "./providers/fal";
import { completeJob, failJob } from "./jobs";

// Server-only: reconciliation talks to fal + Blob + Postgres.
if (typeof window !== "undefined") {
  throw new Error("lib/reconcileJobs.ts was imported in a client bundle");
}

/** Don't poll fal for a job younger than this — the submit just happened. */
const MIN_AGE_MS = 5_000;
/** Only flip to error on a hard fal failure once the job is clearly stuck. */
const FAIL_AFTER_MS = 5 * 60_000;
/** Cap fal calls per sweep so a busy queue can't stall the request. */
const MAX_PER_SWEEP = 8;

/**
 * Ask fal where a single in-flight job stands. Completes it if fal is done,
 * fails it if fal hard-errored and it's been stuck a while. Returns the live
 * queue position (or null) so callers can surface progress.
 */
export async function reconcileJob(job: JobRow): Promise<number | null> {
  if (!job.request_id) return null;
  const ageMs = Date.now() - new Date(job.created_at).getTime();
  try {
    const { status, queuePosition } = await falProvider.getQueueDetails(job.model, job.request_id);
    if (status === "COMPLETED") {
      const payload = await falProvider.getJobResult(job.model, job.request_id);
      await completeJob(job, payload);
      return null;
    }
    return queuePosition;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // fal returns a 4xx for failed/expired requests — surface it once it's stuck.
    if (/not found|failed|422|400/i.test(message) && ageMs > FAIL_AFTER_MS) {
      await failJob(job.id, `poll fallback: ${message}`);
    }
    return null;
  }
}

/**
 * Reconcile every in-flight job with fal in one bounded sweep. This is the
 * polling fallback that drives completion when the webhook can't reach us
 * (always true in local dev: fal can't call localhost). Returns a map of
 * jobId -> live queue position for progress display.
 */
export async function reconcileInFlight(): Promise<Map<number, number | null>> {
  const positions = new Map<number, number | null>();
  let rows: JobRow[];
  try {
    rows = (await sql`
      SELECT * FROM jobs
      WHERE status IN ('queued', 'running')
        AND request_id IS NOT NULL
        AND created_at < now() - ${`${MIN_AGE_MS} milliseconds`}::interval
      ORDER BY created_at ASC
      LIMIT ${MAX_PER_SWEEP}
    `) as JobRow[];
  } catch {
    return positions;
  }

  await Promise.allSettled(
    rows.map(async (job) => {
      const pos = await reconcileJob(job);
      positions.set(job.id, pos);
    })
  );
  return positions;
}

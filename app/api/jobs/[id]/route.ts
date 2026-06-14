import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, type JobRow } from "@/lib/db";
import { reconcileJob } from "@/lib/reconcileJobs";
import { falProvider } from "@/lib/providers/fal";
import { OPERATOR_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

const POLL_FALLBACK_AGE_MS = 5_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await sql`SELECT * FROM jobs WHERE id = ${Number(id)}`;
  let job = rows[0] as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Polling fallback: if the webhook hasn't landed, ask fal's queue directly.
  const ageMs = Date.now() - new Date(job.created_at).getTime();
  if (
    (job.status === "queued" || job.status === "running") &&
    job.request_id &&
    ageMs > POLL_FALLBACK_AGE_MS
  ) {
    await reconcileJob(job);
    job = ((await sql`SELECT * FROM jobs WHERE id = ${job.id}`) as JobRow[])[0];
  }

  const assets = await sql`SELECT * FROM assets WHERE job_id = ${job.id} ORDER BY id`;
  return NextResponse.json({ job, assets });
}

/** Cancel an in-flight job: best-effort fal cancel, then mark it canceled. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const rows = await sql`SELECT * FROM jobs WHERE id = ${jobId}`;
  const job = rows[0] as JobRow | undefined;
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (job.status !== "queued" && job.status !== "running") {
    // Already terminal — nothing to cancel. Report the real status (race-safe).
    return NextResponse.json({ ok: false, error: "not_cancelable", status: job.status }, { status: 409 });
  }

  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";

  // Tell fal to drop it; ignore failures (it may have just finished/expired).
  if (job.request_id) {
    try {
      await falProvider.cancelJob(job.model, job.request_id);
    } catch {
      /* already gone on fal — we still mark it canceled locally */
    }
  }

  // Only flip if still in flight; a webhook/poll may have completed it meanwhile.
  const updated = await sql`
    UPDATE jobs SET status = 'canceled', completed_at = now(), error = ${`canceled by ${operator}`}
    WHERE id = ${jobId} AND status IN ('queued', 'running')
    RETURNING id
  `;
  if (!updated[0]) {
    const fresh = (await sql`SELECT status FROM jobs WHERE id = ${jobId}`) as { status: string }[];
    return NextResponse.json({ ok: false, status: fresh[0]?.status ?? "unknown" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, id: jobId, status: "canceled" });
}

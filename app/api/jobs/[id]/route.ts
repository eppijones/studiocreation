import { NextResponse } from "next/server";
import { sql, type JobRow } from "@/lib/db";
import { falProvider } from "@/lib/providers/fal";
import { completeJob, failJob } from "@/lib/jobs";

export const maxDuration = 60;

const POLL_FALLBACK_AGE_MS = 20_000;

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
    try {
      const status = await falProvider.getJobStatus(job.model, job.request_id);
      if (status === "COMPLETED") {
        const payload = await falProvider.getJobResult(job.model, job.request_id);
        await completeJob(job, payload);
        job = ((await sql`SELECT * FROM jobs WHERE id = ${job.id}`) as JobRow[])[0];
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // fal returns a 4xx for failed/expired requests — surface it.
      if (/not found|failed|422|400/i.test(message) && ageMs > 5 * 60_000) {
        await failJob(job.id, `poll fallback: ${message}`);
      }
    }
  }

  const assets = await sql`SELECT * FROM assets WHERE job_id = ${job.id} ORDER BY id`;
  return NextResponse.json({ job, assets });
}

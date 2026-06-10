import { NextResponse } from "next/server";
import { sql, type JobRow } from "@/lib/db";
import { completeJob, failJob } from "@/lib/jobs";
import { verifyFalWebhook } from "@/lib/falWebhook";

export const maxDuration = 60;

interface FalWebhookBody {
  request_id: string;
  status: "OK" | "ERROR";
  payload?: Record<string, unknown>;
  error?: string;
}

export async function POST(request: Request) {
  const rawBody = await request.arrayBuffer();

  const valid = await verifyFalWebhook(request, rawBody);
  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(new TextDecoder().decode(rawBody)) as FalWebhookBody;
  const jobIdParam = new URL(request.url).searchParams.get("jobId");

  const rows = jobIdParam
    ? await sql`SELECT * FROM jobs WHERE id = ${Number(jobIdParam)}`
    : await sql`SELECT * FROM jobs WHERE request_id = ${body.request_id}`;
  const job = rows[0] as JobRow | undefined;

  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  if (job.request_id && job.request_id !== body.request_id) {
    return NextResponse.json({ error: "request_id mismatch" }, { status: 400 });
  }

  if (body.status === "ERROR" || !body.payload) {
    await failJob(job.id, body.error ?? "fal reported an error");
    return NextResponse.json({ ok: true });
  }

  try {
    await completeJob(job, body.payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 500 → fal retries the webhook; polling fallback also remains.
    const message = err instanceof Error ? err.message : "completion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

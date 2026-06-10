import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, type JobRow } from "@/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

const DRIFT_THRESHOLD = 0.1;

interface BillingEvent {
  request_id?: string;
  endpoint_id?: string;
  quantity?: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
  amount?: number;
}

function eventUsd(ev: BillingEvent): number | null {
  if (typeof ev.total_price === "number") return ev.total_price;
  if (typeof ev.price === "number") return ev.price;
  if (typeof ev.amount === "number") return ev.amount;
  if (typeof ev.quantity === "number" && typeof ev.unit_price === "number") {
    return ev.quantity * ev.unit_price;
  }
  return null;
}

async function authorized(request: Request): Promise<boolean> {
  // Vercel cron
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  // Studio session
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return true;
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, password);
}

async function reconcile(): Promise<Response> {
  const apiKey = process.env.FAL_ADMIN_KEY ?? process.env.FAL_KEY;
  const end = new Date();
  const start = new Date(end.getTime() - 89 * 24 * 3600 * 1000);

  const events: BillingEvent[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://api.fal.ai/v1/models/billing-events");
    url.searchParams.set("start", start.toISOString().slice(0, 10));
    url.searchParams.set("end", end.toISOString().slice(0, 10));
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: `Key ${apiKey}` } });
    if (!res.ok) {
      const detail = res.status === 403 || res.status === 401
        ? "fal Platform API rejected the key — create an ADMIN-scope key at fal.ai/dashboard/keys and set FAL_ADMIN_KEY"
        : `fal Platform API error ${res.status}`;
      return NextResponse.json({ matched: 0, driftFlags: [], error: detail }, { status: 200 });
    }
    const data = await res.json();
    const items: BillingEvent[] = data.items ?? data.events ?? data.data ?? [];
    events.push(...items);
    cursor = data.next_cursor ?? null;
    if (!cursor || items.length === 0) break;
  }

  const byRequestId = new Map<string, BillingEvent>();
  for (const ev of events) {
    if (ev.request_id) byRequestId.set(ev.request_id, ev);
  }

  const jobs = (await sql`
    SELECT * FROM jobs
    WHERE provider = 'fal' AND request_id IS NOT NULL AND status = 'done'
  `) as JobRow[];

  let matched = 0;
  const driftFlags: { jobId: number; estUsd: number; actualUsd: number }[] = [];

  for (const job of jobs) {
    const ev = byRequestId.get(job.request_id!);
    if (!ev) continue;
    const actual = eventUsd(ev);
    if (actual === null) continue;
    matched++;
    await sql`UPDATE jobs SET actual_usd = ${actual} WHERE id = ${job.id}`;
    const est = Number(job.est_usd);
    if (est > 0 && Math.abs(actual - est) / est > DRIFT_THRESHOLD) {
      driftFlags.push({ jobId: job.id, estUsd: est, actualUsd: actual });
    }
  }

  return NextResponse.json({
    matched,
    driftFlags,
    message: `${events.length} billing events scanned, ${jobs.length} ledger rows checked`,
  });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return reconcile();
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return reconcile();
}

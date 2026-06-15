import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Estimate accuracy per model: how far est_usd lands from the reconciled
 * actual_usd (fal billing). Turns the preflight from "predicted" into a
 * historically verified number.
 */
export async function GET() {
  const rows = await sql`
    SELECT model,
           COUNT(*) AS reconciled_jobs,
           AVG(ABS(actual_usd - est_usd) / NULLIF(est_usd, 0)) AS mean_drift,
           MAX(ABS(actual_usd - est_usd) / NULLIF(est_usd, 0)) AS max_drift
    FROM jobs
    WHERE status = 'done' AND actual_usd IS NOT NULL AND est_usd > 0
    GROUP BY model
  `;
  const byModel: Record<
    string,
    { reconciledJobs: number; meanDriftPct: number; maxDriftPct: number }
  > = {};
  for (const r of rows) {
    byModel[r.model as string] = {
      reconciledJobs: Number(r.reconciled_jobs),
      meanDriftPct: Math.round(Number(r.mean_drift ?? 0) * 1000) / 10,
      maxDriftPct: Math.round(Number(r.max_drift ?? 0) * 1000) / 10,
    };
  }
  return NextResponse.json({ byModel });
}

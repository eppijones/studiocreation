import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { reconcileInFlight } from "@/lib/reconcileJobs";
import { modelMedianDurations, fallbackDurationMs, clampEtaMs } from "@/lib/eta";

export const maxDuration = 60;

export async function GET() {
  // Drive completion: ask fal about in-flight jobs (the webhook can't reach
  // localhost in dev, so this poll is what actually lands renders).
  const positions = await reconcileInFlight();
  const medians = await modelMedianDurations();

  const jobs = (await sql`
    SELECT j.id, j.model, j.prompt, j.status, j.est_usd, j.operator, j.project, j.label,
           j.request_id, j.error, j.created_at, j.completed_at,
           COALESCE(json_agg(json_build_object('id', a.id, 'blob_url', a.blob_url, 'content_type', a.content_type, 'score', a.score))
                    FILTER (WHERE a.id IS NOT NULL), '[]') AS assets
    FROM jobs j
    LEFT JOIN assets a ON a.job_id = j.id
    GROUP BY j.id
    ORDER BY j.created_at DESC
    LIMIT 30
  `) as Record<string, unknown>[];

  const now = Date.now();
  const enriched = jobs.map((j) => {
    if (j.status !== "queued" && j.status !== "running") return j;
    const model = String(j.model);
    const eta = medians.get(model);
    const medianMs = clampEtaMs(model, eta?.medianMs ?? fallbackDurationMs(model));
    const elapsedMs = Math.max(now - new Date(String(j.created_at)).getTime(), 0);
    return {
      ...j,
      medianMs,
      samples: eta?.samples ?? 0,
      elapsedMs,
      etaMs: Math.max(medianMs - elapsedMs, 0),
      queuePosition: positions.get(j.id as number) ?? null,
    };
  });

  return NextResponse.json({ jobs: enriched });
}

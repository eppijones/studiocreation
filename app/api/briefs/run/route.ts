import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listBriefs } from "@/lib/briefs";
import { getBudgetState } from "@/lib/budget";
import { falProvider } from "@/lib/providers/fal";
import { buildFalInput } from "@/lib/providers/falInput";
import { sql } from "@/lib/db";
import { OPERATOR_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

function baseUrl(): string {
  if (process.env.STUDIO_BASE_URL) return process.env.STUDIO_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const { briefId, confirmed } = await request.json();

  const brief = listBriefs().find((b) => b.id === briefId);
  if (!brief) return NextResponse.json({ error: "brief not found" }, { status: 404 });
  if (brief.shots.length === 0) {
    return NextResponse.json({ error: "brief has no parsable shots" }, { status: 400 });
  }

  // ONE spend card for the whole batch — explicit confirm always required.
  if (confirmed !== true) {
    return NextResponse.json(
      { error: "confirm_required", totalUsd: brief.totalUsd, shots: brief.shots },
      { status: 402 }
    );
  }

  const budget = await getBudgetState();
  if (brief.totalUsd > budget.remainingUsd) {
    return NextResponse.json(
      { error: "daily_cap_exceeded", totalUsd: brief.totalUsd, budget },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";

  const queued: { jobId: number; label: string; requestId?: string; error?: string }[] = [];
  for (const shot of brief.shots) {
    const spec = {
      prompt: shot.prompt,
      kind: shot.kind,
      numImages: shot.kind === "image" ? shot.count : 1,
      seconds: shot.kind === "video" ? shot.count : 5,
      ratio: shot.ratio,
      audio: false,
      fast: false,
      tier: undefined,
    };
    const falInput = buildFalInput(shot.model, spec);
    const inserted = await sql`
      INSERT INTO jobs (provider, model, prompt, params, status, est_usd, operator, project, label)
      VALUES ('fal', ${shot.model}, ${shot.prompt}, ${JSON.stringify({ spec, falInput, brief: brief.id })},
              'queued', ${shot.estUsd}, ${operator}, ${brief.project}, ${shot.label})
      RETURNING id
    `;
    const jobId = inserted[0].id as number;
    try {
      const { requestId } = await falProvider.submitJob({
        model: shot.model,
        input: falInput,
        webhookUrl: `${baseUrl()}/api/webhooks/fal?jobId=${jobId}`,
      });
      await sql`UPDATE jobs SET request_id = ${requestId}, status = 'running' WHERE id = ${jobId}`;
      queued.push({ jobId, label: shot.label, requestId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "submit failed";
      await sql`UPDATE jobs SET status = 'error', error = ${message} WHERE id = ${jobId}`;
      queued.push({ jobId, label: shot.label, error: message });
    }
  }

  return NextResponse.json({ queued, totalUsd: brief.totalUsd });
}

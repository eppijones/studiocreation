import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { estimate, CONFIRM_THRESHOLD_USD } from "@/lib/pricing";
import { getBudgetState } from "@/lib/budget";
import { falProvider } from "@/lib/providers/fal";
import { sql, type JobRow } from "@/lib/db";
import { OPERATOR_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

const ALLOWED_MODELS = ["fal-ai/flux/schnell"];

function baseUrl(): string {
  if (process.env.STUDIO_BASE_URL) return process.env.STUDIO_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  const body = await request.json();
  const prompt: string = (body.prompt ?? "").trim();
  const model: string = body.model ?? "fal-ai/flux/schnell";
  const numImages: number = Math.min(Math.max(Number(body.numImages) || 1, 1), 4);
  const project: string = (body.project ?? "studio").trim() || "studio";
  const label: string = (body.label ?? "asset").trim() || "asset";
  const confirmed: boolean = body.confirmed === true;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return NextResponse.json({ error: `Model not enabled yet: ${model}` }, { status: 400 });
  }

  const est = estimate({ provider: "fal", model, count: numImages });

  // Budget law: hard daily cap, confirm gate above threshold.
  const budget = await getBudgetState();
  if (est.usd > budget.remainingUsd) {
    return NextResponse.json(
      { error: "daily_cap_exceeded", estimate: est, budget },
      { status: 403 }
    );
  }
  if (est.usd > CONFIRM_THRESHOLD_USD && !confirmed) {
    return NextResponse.json(
      { error: "confirm_required", estimate: est, threshold: CONFIRM_THRESHOLD_USD },
      { status: 402 }
    );
  }

  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";

  const params = { numImages };
  const inserted = await sql`
    INSERT INTO jobs (provider, model, prompt, params, status, est_usd, operator, project, label)
    VALUES ('fal', ${model}, ${prompt}, ${JSON.stringify(params)}, 'queued', ${est.usd}, ${operator}, ${project}, ${label})
    RETURNING id
  `;
  const jobId = inserted[0].id as number;

  try {
    const { requestId } = await falProvider.submitJob({
      model,
      input: { prompt, num_images: numImages },
      webhookUrl: `${baseUrl()}/api/webhooks/fal?jobId=${jobId}`,
    });
    await sql`UPDATE jobs SET request_id = ${requestId}, status = 'running' WHERE id = ${jobId}`;
    return NextResponse.json({ jobId, requestId, estimate: est, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Queue submission failed";
    await sql`UPDATE jobs SET status = 'error', error = ${message} WHERE id = ${jobId}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export type { JobRow };

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { estimate } from "@/lib/pricing";
import { getBudgetState } from "@/lib/budget";
import { falProvider } from "@/lib/providers/fal";
import { buildFinishPlan, type FinishAction } from "@/lib/finishing";
import { OPERATOR_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

const ACTIONS: FinishAction[] = ["upscale-video-4k", "upscale-image-4k", "upscale-image-crisp"];

function baseUrl(): string {
  if (process.env.STUDIO_BASE_URL) return process.env.STUDIO_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

/** Queue a cloud finishing job (Topaz/Recraft) on an existing asset. */
export async function POST(request: Request) {
  const body = await request.json();
  const assetId = Number(body.assetId);
  const action = body.action as FinishAction;
  const confirmed = body.confirmed === true;

  if (!Number.isInteger(assetId) || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "assetId and a valid action are required" }, { status: 400 });
  }

  const rows = await sql`
    SELECT a.*, j.project, j.label AS job_label
    FROM assets a JOIN jobs j ON j.id = a.job_id
    WHERE a.id = ${assetId}
  `;
  const asset = rows[0];
  if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });

  const isVideo = String(asset.content_type ?? "").startsWith("video");
  if (action === "upscale-video-4k" && !isVideo) {
    return NextResponse.json({ error: "asset is not a video" }, { status: 400 });
  }
  if (action !== "upscale-video-4k" && isVideo) {
    return NextResponse.json({ error: "asset is not an image" }, { status: 400 });
  }

  const plan = buildFinishPlan(action, asset.blob_url as string, {
    durationS: asset.duration_s as number | null,
    targetFps: body.targetFps ? Number(body.targetFps) : undefined,
    upscaleFactor: body.upscaleFactor ? Number(body.upscaleFactor) : undefined,
  });

  const est = estimate({ provider: "fal", model: plan.model, count: plan.count });
  // Topaz doubles the per-second price for 60fps output.
  if (action === "upscale-video-4k" && Number(body.targetFps) >= 50) est.usd *= 2;

  const budget = await getBudgetState();
  if (est.usd > budget.remainingWeekUsd || est.usd > budget.remainingMonthUsd) {
    return NextResponse.json({ error: "cap_exceeded", estimate: est, budget }, { status: 403 });
  }
  if (est.usd > budget.settings.confirmThresholdUsd && !confirmed) {
    return NextResponse.json(
      { error: "confirm_required", estimate: est, threshold: budget.settings.confirmThresholdUsd },
      { status: 402 }
    );
  }

  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";

  const inserted = await sql`
    INSERT INTO jobs (provider, model, prompt, params, status, est_usd, operator, project, label, source_asset_id)
    VALUES ('fal', ${plan.model}, ${`finish: ${action} of asset #${assetId}`},
            ${JSON.stringify({ action, input: plan.input, sourceAssetId: assetId })},
            'queued', ${est.usd}, ${operator}, ${asset.project},
            ${`${asset.job_label}-${plan.label}`}, ${assetId})
    RETURNING id
  `;
  const jobId = inserted[0].id as number;

  try {
    const { requestId } = await falProvider.submitJob({
      model: plan.model,
      input: plan.input,
      webhookUrl: `${baseUrl()}/api/webhooks/fal?jobId=${jobId}`,
    });
    await sql`UPDATE jobs SET request_id = ${requestId}, status = 'running' WHERE id = ${jobId}`;
    return NextResponse.json({ jobId, requestId, estimate: est });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Queue submission failed";
    await sql`UPDATE jobs SET status = 'error', error = ${message} WHERE id = ${jobId}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

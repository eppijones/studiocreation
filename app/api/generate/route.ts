import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { estimate, modelUnit, listModels, coerceSeconds } from "@/lib/pricing";
import { getBudgetState } from "@/lib/budget";
import { falProvider } from "@/lib/providers/fal";
import { buildFalInput, falEndpoint, type GenerateSpec } from "@/lib/providers/falInput";
import { sql } from "@/lib/db";
import { OPERATOR_COOKIE } from "@/lib/auth";

export const maxDuration = 60;

const MODELS = listModels();
const ALLOWED_MODELS = new Set(MODELS.map((m) => m.id));

function baseUrl(): string {
  if (process.env.STUDIO_BASE_URL) return process.env.STUDIO_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

// References must be the studio's own assets — Vercel Blob or fal media — never
// an arbitrary remote URL a client could use to steer a paid render's input.
// Extra hosts can be allowlisted via STUDIO_REF_HOSTS (comma-separated).
const REF_HOST_RE = /(?:^|\.)(?:blob\.vercel-storage\.com|fal\.media)$/i;
function allowedRefHost(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (REF_HOST_RE.test(url.hostname)) return true;
  const extra = (process.env.STUDIO_REF_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

function cleanUrls(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((u): u is string => typeof u === "string" && allowedRefHost(u))
    .slice(0, max);
}

export async function POST(request: Request) {
  const body = await request.json();
  const prompt: string = (body.prompt ?? "").trim();
  const model: string = body.model ?? "openai/gpt-image-2";
  const project: string = (body.project ?? "studio").trim() || "studio";
  const label: string = (body.label ?? "asset").trim() || "asset";
  // The role (skill/employee) this job ran under — tags the render so the Create
  // grid can wear each role's own best work. Free-form string, kept short.
  const role: string | undefined =
    typeof body.role === "string" && body.role.trim() ? body.role.trim().slice(0, 80) : undefined;
  const confirmed: boolean = body.confirmed === true;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
  }
  const info = MODELS.find((m) => m.id === model)!;
  if (info.tier === "finish") {
    return NextResponse.json({ error: "Finishing models run from the Finalize Center" }, { status: 400 });
  }

  // Clamp every native param into the model's envelope (defence in depth — the
  // composer already enforces these, but the API never trusts the client).
  const numImages = Math.min(Math.max(Number(body.numImages) || info.numImages.min, info.numImages.min), info.numImages.max);
  const seconds = coerceSeconds(info.durations, Number(body.seconds) || 0);
  const ratio = info.ratios.includes(body.ratio) ? body.ratio : info.ratios[0] ?? "1:1";
  const audio = info.hasAudio && body.audio === true;
  const fast = info.hasFast && body.fast === true;
  const tier: string | undefined = info.has4k && body.tier === "4k" ? "4k" : undefined;

  const quality: string | undefined =
    info.qualities.length && info.qualities.includes(body.quality) ? body.quality : undefined;
  const refImageUrls = cleanUrls(body.refImageUrls, info.refImages);
  const refVideoUrls = cleanUrls(body.refVideoUrls, info.refVideos);
  const refAudioUrls = cleanUrls(body.refAudioUrls, info.refAudio);
  const negativePrompt: string | undefined =
    info.hasNegative && typeof body.negativePrompt === "string" && body.negativePrompt.trim()
      ? body.negativePrompt.trim().slice(0, 500)
      : undefined;

  // Reference-required models can't run from text alone. Edit / image-to-video
  // need a still (start frame / subject); the reference-to-video stack accepts
  // any reference (image, video or audio).
  if (info.requiresRef) {
    const totalRefs = refImageUrls.length + refVideoUrls.length + refAudioUrls.length;
    const ok = info.kind === "reference-to-video" ? totalRefs > 0 : refImageUrls.length > 0;
    if (!ok) {
      return NextResponse.json(
        {
          error:
            info.kind === "reference-to-video"
              ? `${info.label} needs at least one reference (image, video or audio).`
              : `${info.label} needs at least one reference image.`,
        },
        { status: 400 }
      );
    }
  }

  const kind = modelUnit(model) === "video_second" ? "video" : "image";
  const count = kind === "video" ? seconds : numImages;
  const est = estimate({ provider: "fal", model, count, tier, quality, audio, fast });

  // Budget law: shared weekly cap + monthly team pool are hard stops; confirm gate above threshold.
  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const budget = await getBudgetState(operator);
  if (est.usd > budget.remainingWeekUsd) {
    return NextResponse.json({ error: "weekly_cap_exceeded", estimate: est, budget }, { status: 403 });
  }
  if (est.usd > budget.remainingMonthUsd) {
    return NextResponse.json({ error: "monthly_pool_exceeded", estimate: est, budget }, { status: 403 });
  }
  if (est.usd > budget.settings.confirmThresholdUsd && !confirmed) {
    return NextResponse.json(
      { error: "confirm_required", estimate: est, threshold: budget.settings.confirmThresholdUsd },
      { status: 402 }
    );
  }

  const spec: GenerateSpec = {
    prompt, kind, numImages, seconds, ratio, audio, fast, tier, quality,
    refImageUrls, refVideoUrls, refAudioUrls, negativePrompt,
  };
  const falInput = buildFalInput(model, spec);
  const endpoint = falEndpoint(model, spec);

  const inserted = await sql`
    INSERT INTO jobs (provider, model, prompt, params, status, est_usd, operator, project, label)
    VALUES ('fal', ${endpoint}, ${prompt}, ${JSON.stringify({ spec, falInput, role })}, 'queued',
            ${est.usd}, ${operator}, ${project}, ${label})
    RETURNING id
  `;
  const jobId = inserted[0].id as number;

  try {
    const { requestId } = await falProvider.submitJob({
      model: endpoint,
      input: falInput,
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

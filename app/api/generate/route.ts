import { NextResponse } from "next/server";
import { estimate, CONFIRM_THRESHOLD_USD } from "@/lib/pricing";
import { falProvider } from "@/lib/providers/fal";

export const maxDuration = 60;

const ALLOWED_MODELS = ["fal-ai/flux/schnell"];

export async function POST(request: Request) {
  const body = await request.json();
  const prompt: string = (body.prompt ?? "").trim();
  const model: string = body.model ?? "fal-ai/flux/schnell";
  const numImages: number = Math.min(Math.max(Number(body.numImages) || 1, 1), 4);
  const confirmed: boolean = body.confirmed === true;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return NextResponse.json({ error: `Model not enabled yet: ${model}` }, { status: 400 });
  }

  const est = estimate({ provider: "fal", model, count: numImages });
  if (est.usd > CONFIRM_THRESHOLD_USD && !confirmed) {
    return NextResponse.json(
      { error: "confirm_required", estimate: est, threshold: CONFIRM_THRESHOLD_USD },
      { status: 402 }
    );
  }

  try {
    const result = await falProvider.generateImage({ model, prompt, numImages });
    return NextResponse.json({ ...result, estimate: est, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

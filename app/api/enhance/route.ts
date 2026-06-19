import { NextResponse } from "next/server";
import { enhancePrompt } from "@/lib/enhance";
import { listModels, modelUnit } from "@/lib/pricing";

export const maxDuration = 30;

const ALLOWED = new Set(listModels().map((m) => m.id));

// Real model path: Claude Haiku 4.5 via the Messages API (sub-cent per call). Gated on
// ANTHROPIC_API_KEY — with no key set (or on any error/timeout) we fall back to the
// deterministic stub in lib/enhance.ts, so Enhance always works. Raw fetch keeps this
// dependency-free; the response shape is identical either way: { enhanced, added, changed }.
async function enhanceWithClaude(prompt: string, isVideo: boolean): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const kind = isVideo ? "AI video generation" : "AI image generation";
  const system =
    `You rewrite a creative's rough prompt into a single, model-optimal ${kind} prompt. ` +
    `Keep their intent and subject; add only craft that helps — composition, lighting, ` +
    `lens/camera${isVideo ? " and motion" : ""}, detail. Do not over-specify or pad. ` +
    `Reply with ONLY the rewritten prompt — no preamble, no quotes, no explanation.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 320,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = Array.isArray(data?.content)
      ? data.content
          .filter((b: { type?: string }) => b.type === "text")
          .map((b: { text?: string }) => b.text ?? "")
          .join("")
          .trim()
      : "";
    return text || null;
  } catch {
    return null;
  }
}

// POST { prompt, model } → { enhanced, added, changed }
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt: string = typeof body.prompt === "string" ? body.prompt : "";
  const model: string =
    typeof body.model === "string" && ALLOWED.has(body.model) ? body.model : "openai/gpt-image-2";

  const trimmed = prompt.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const isVideo = modelUnit(model) === "video_second";
  const fromModel = await enhanceWithClaude(trimmed, isVideo);
  if (fromModel) {
    return NextResponse.json({ enhanced: fromModel, added: [], changed: fromModel !== trimmed, engine: "claude" });
  }

  // No key, or the call failed — deterministic, model-aware stub keeps Enhance
  // working. `engine: "heuristic"` lets the UI nudge toward the real AI rewrite.
  return NextResponse.json({ ...enhancePrompt(trimmed, model), engine: "heuristic" });
}

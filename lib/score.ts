import { fal } from "@fal-ai/client";
import { sql, type JobRow } from "./db";
import { getStudioSettings } from "./settings";
import pricing from "@/config/pricing.json";

// Server-only: the scorer talks to fal with FAL_KEY.
if (typeof window !== "undefined") {
  throw new Error("lib/score.ts was imported in a client bundle");
}

interface ScoringConfig {
  model: string;
  llmModel?: string;
  usd: number;
}
const SCORER = (pricing as { providers: { fal: { scoring?: ScoringConfig } } }).providers.fal
  .scoring;

export interface ParsedScore {
  score: number;
  note: string;
}

const SYSTEM_PROMPT =
  "You are a ruthless senior art director scoring a finished render against the brief it was generated from. " +
  "Judge fidelity to the prompt, composition, craft and finish. Reply ONLY with compact JSON: " +
  '{"score": <integer 0-10>, "note": "<=14 words, what works or what is off>"}.';

function scorePrompt(prompt: string): string {
  const brief = (prompt || "").slice(0, 600);
  return `The prompt this render was generated from:\n"""${brief}"""\n\nScore how accurately the image delivers that brief.`;
}

/** Pull {score, note} out of the model's text, tolerating prose around the JSON. */
export function parseScore(text: string): ParsedScore | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as { score?: unknown; note?: unknown };
    const score = Math.round(Number(obj.score));
    if (!Number.isFinite(score) || score < 0 || score > 10) return null;
    const note = typeof obj.note === "string" ? obj.note.slice(0, 240) : "";
    return { score, note };
  } catch {
    return null;
  }
}

async function scoreOne(blobUrl: string, prompt: string): Promise<ParsedScore | null> {
  if (!SCORER?.model) return null;
  const input: Record<string, unknown> = {
    prompt: scorePrompt(prompt),
    system_prompt: SYSTEM_PROMPT,
    image_urls: [blobUrl],
  };
  if (SCORER.llmModel) input.model = SCORER.llmModel;
  const result = await fal.subscribe(SCORER.model, { input });
  const data = result.data as { output?: unknown; text?: unknown };
  const text = typeof data.output === "string" ? data.output : typeof data.text === "string" ? data.text : "";
  return parseScore(text);
}

/**
 * Best-effort: rate freshly-finished image assets against their prompt and
 * persist score + critique. Gated by the `autoScore` studio setting. Never
 * throws — scoring must not block delivery.
 */
export async function scoreAssets(job: JobRow, assetIds: number[]): Promise<void> {
  if (assetIds.length === 0 || !SCORER?.model) return;
  try {
    const settings = await getStudioSettings();
    if (!settings.autoScore) return;
  } catch {
    return;
  }

  for (const id of assetIds) {
    try {
      const rows = await sql`SELECT blob_url, content_type FROM assets WHERE id = ${id}`;
      const asset = rows[0] as { blob_url: string; content_type: string | null } | undefined;
      if (!asset) continue;
      // Vision scoring is image-only; skip video for now.
      if (asset.content_type?.startsWith("video")) continue;
      const parsed = await scoreOne(asset.blob_url, job.prompt);
      if (parsed) {
        await sql`UPDATE assets SET score = ${parsed.score}, review_note = ${parsed.note} WHERE id = ${id}`;
      }
    } catch {
      // best-effort per asset
    }
  }
}

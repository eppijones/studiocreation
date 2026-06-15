/** Prompt enhancer — turns a plain one-liner into a more model-optimal prompt
 *  before any spend, so non-expert operators get good results on the first go.
 *
 *  NOTE: this is a deterministic, model-aware STUB — the same demo pattern as the
 *  brand "formula". It appends tasteful craft cues (camera / light / detail) only
 *  where the prompt is missing them, and never over-specifies. Swap the body for a
 *  real model call (claude-*) when an LLM key is wired; keep the return shape stable.
 */
import { modelUnit } from "@/lib/pricing";

export interface EnhanceResult {
  /** the rewritten prompt (original + appended cues) */
  enhanced: string;
  /** the craft cues we added, for a "what changed" hint in the UI */
  added: string[];
  /** false when the prompt was already rich enough to leave alone */
  changed: boolean;
}

type Cue = { test: RegExp; add: string };

// Each cue covers one craft dimension. We add it ONLY when the prompt doesn't
// already speak to that dimension, so we never fight the operator's intent.
const VIDEO_CUES: Cue[] = [
  { test: /camera|dolly|push|pan|track|orbit|zoom|handheld|crane|tilt|static|locked|aerial|drone|move/i, add: "smooth deliberate camera move" },
  { test: /light|lit|sunset|golden|neon|backlit|rim|shadow|moody|dusk|dawn|glow/i, add: "cinematic lighting" },
  { test: /lens|bokeh|depth of field|shallow|focus|macro|wide.?angle|anamorphic/i, add: "shallow depth of field" },
  { test: /cinematic|filmic|\bfilm\b|movie|epic|dramatic|grade/i, add: "filmic color grade" },
  { test: /\b(4k|8k|detail|sharp|crisp|hyper|high.?res|resolution)\b/i, add: "high detail" },
];

const IMAGE_CUES: Cue[] = [
  { test: /compos|framing|centered|rule of thirds|symmetr|angle|overhead|close.?up|wide|portrait|landscape/i, add: "balanced composition" },
  { test: /light|lit|studio|soft|backlit|rim|golden|natural light|shadow|glow/i, add: "soft studio lighting" },
  { test: /focus|sharp|crisp|bokeh|depth of field/i, add: "sharp focus" },
  { test: /\b(4k|8k|detail|hyper|high.?res|resolution|quality|render)\b/i, add: "high detail" },
];

export function enhancePrompt(rawPrompt: string, model: string): EnhanceResult {
  const prompt = rawPrompt.trim().replace(/[\s,]+$/g, "");
  if (!prompt) return { enhanced: "", added: [], changed: false };

  const isVideo = modelUnit(model) === "video_second";
  const cues = isVideo ? VIDEO_CUES : IMAGE_CUES;

  // Respect "don't over-specify": a prompt that's already rich gets left alone,
  // a medium one gets a single nudge, a bare one gets the full craft pass.
  const wordCount = prompt.split(/\s+/).length;
  const room = wordCount > 45 ? 0 : wordCount > 28 ? 1 : 3;

  const added: string[] = [];
  for (const cue of cues) {
    if (added.length >= room) break;
    if (!cue.test.test(prompt)) added.push(cue.add);
  }

  const enhanced = added.length ? `${prompt}, ${added.join(", ")}` : prompt;
  return { enhanced, added, changed: added.length > 0 };
}

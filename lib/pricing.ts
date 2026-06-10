import pricing from "@/config/pricing.json";

export interface JobSpec {
  provider: "fal";
  model: string;
  /** image count for image models, seconds for video models */
  count: number;
  /** resolution tier key, e.g. "4k" */
  tier?: string;
  /** audio-on pricing for video models that charge extra */
  audio?: boolean;
  /** fast-mode pricing where available */
  fast?: boolean;
}

export interface Estimate {
  usd: number;
  unit: string;
  unitUsd: number;
  count: number;
  breakdown: string;
}

interface ModelPricing {
  unit: string;
  usd: number;
  tiers?: Record<string, number>;
  audio_on?: number;
  fast?: number;
}

const FAL_MODELS = pricing.providers.fal.models as Record<string, ModelPricing>;

/** Budget law (PLAN.md §4): jobs above this need an explicit confirm. */
export const CONFIRM_THRESHOLD_USD = 1.25;
/** Shared daily soft cap across all operators. */
export const DAILY_CAP_USD = 7.5;

export function estimate(spec: JobSpec): Estimate {
  const model = FAL_MODELS[spec.model];
  if (!model) throw new Error(`Unknown model: ${spec.model}`);

  let unitUsd = model.usd;
  const notes: string[] = [];
  if (spec.tier && model.tiers?.[spec.tier] !== undefined) {
    unitUsd = model.tiers[spec.tier];
    notes.push(spec.tier);
  }
  if (spec.audio && model.audio_on !== undefined) {
    unitUsd = model.audio_on;
    notes.push("audio on");
  }
  if (spec.fast && model.fast !== undefined) {
    unitUsd = model.fast;
    notes.push("fast");
  }

  const usd = unitUsd * spec.count;
  const noteStr = notes.length ? ` (${notes.join(", ")})` : "";
  const breakdown = `${spec.count} × $${unitUsd.toFixed(4)}/${model.unit}${noteStr} = $${usd.toFixed(4)}`;
  return { usd, unit: model.unit, unitUsd, count: spec.count, breakdown };
}

export interface ModelInfo {
  id: string;
  unit: string;
  usd: number;
  has4k: boolean;
  hasAudio: boolean;
  hasFast: boolean;
}

export function listModels(): ModelInfo[] {
  return Object.entries(FAL_MODELS).map(([id, m]) => ({
    id,
    unit: m.unit,
    usd: m.usd,
    has4k: m.tiers?.["4k"] !== undefined,
    hasAudio: m.audio_on !== undefined,
    hasFast: m.fast !== undefined,
  }));
}

export function modelUnit(model: string): string {
  return FAL_MODELS[model]?.unit ?? "image";
}

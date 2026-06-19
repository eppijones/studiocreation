import pricing from "@/config/pricing.json";

export type ModelTier = "production" | "hero" | "finish";

export interface JobSpec {
  provider: "fal";
  model: string;
  /** image count for image models, seconds for video models */
  count: number;
  /** resolution tier key, e.g. "4k" */
  tier?: string;
  /** quality key for token-billed models (GPT Image 2: low/medium/high) */
  quality?: string;
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

/** A model's native duration envelope. `none` for images. */
export interface DurationSpec {
  mode: "none" | "range" | "discrete";
  /** range bounds (seconds) */
  min?: number;
  max?: number;
  /** discrete allowed values (seconds) */
  values?: number[];
  /** preferred starting value */
  default?: number;
}

/** Per-type reference media limits (size in MB, length in seconds). */
export interface RefMedia {
  maxImageMB: number;
  maxVideoMB: number;
  maxAudioMB: number;
  maxVideoSec: number;
  maxAudioSec: number;
}

/** Sensible fal-grade defaults; per-model overrides via constraints.refMedia. */
export const REF_MEDIA_DEFAULTS: RefMedia = {
  maxImageMB: 20,
  maxVideoMB: 100,
  maxAudioMB: 30,
  maxVideoSec: 30,
  maxAudioSec: 60,
};

interface ModelConstraints {
  ratios?: string[];
  numImages?: { min: number; max: number };
  duration?: DurationSpec;
  /** native audio generation supported (independent of whether it changes price) */
  audio?: boolean;
  /** negative_prompt supported by the endpoint */
  negative?: boolean;
  /** accepts a `seed` — enables a locked-base one-variable re-roll (vs. drift) */
  seed?: boolean;
  /** cannot run from text alone — needs ≥1 reference */
  requiresRef?: boolean;
  refMedia?: Partial<RefMedia>;
}

interface ModelPricing {
  label?: string;
  unit: string;
  usd: number;
  tier?: string;
  /** Catalog grouping for the full fal dashboard, e.g. image / image-edit / video / video-ref / finish. */
  category?: string;
  /** House top model — pinned in the router, the ones we primarily use. */
  featured?: boolean;
  kind?: string;
  tiers?: Record<string, number>;
  qualities?: Record<string, number>;
  audio_on?: number;
  fast?: number;
  refs?: { images?: number; videos?: number; audio?: number };
  constraints?: ModelConstraints;
  promptHint?: string;
  notes?: string;
}

const FAL_MODELS = pricing.providers.fal.models as Record<string, ModelPricing>;

const IMAGE_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"];
const VIDEO_RATIOS = ["16:9", "9:16", "1:1"];

/** Snap a requested duration into a model's native envelope (UI, server and falInput all use this). */
export function coerceSeconds(d: DurationSpec, seconds: number): number {
  const n = Number.isFinite(seconds) ? seconds : 0;
  if (d.mode === "discrete" && d.values?.length) {
    return d.values.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  }
  if (d.mode === "range") {
    return Math.min(Math.max(Math.round(n), d.min ?? 1), d.max ?? 15);
  }
  return n;
}

/** The value a duration control should open on for a given model. */
export function defaultSeconds(d: DurationSpec): number {
  if (d.default != null) return d.default;
  if (d.mode === "discrete" && d.values?.length) return d.values[0];
  if (d.mode === "range") return d.min ?? 5;
  return 5;
}

/** Budget law: jobs above this need an explicit confirm (overridable in settings). */
export const CONFIRM_THRESHOLD_USD = 1.25;

export function estimate(spec: JobSpec): Estimate {
  const model = FAL_MODELS[spec.model];
  if (!model) throw new Error(`Unknown model: ${spec.model}`);

  let unitUsd = model.usd;
  const notes: string[] = [];
  if (spec.quality && model.qualities?.[spec.quality] !== undefined) {
    unitUsd = model.qualities[spec.quality];
    notes.push(spec.quality);
  }
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

/** Default catalog grouping when a model omits an explicit category. */
function defaultCategory(m: ModelPricing): string {
  if (m.kind?.includes("upscale") || m.tier === "finish") return "finish";
  if (m.kind === "image-edit") return "image-edit";
  if (m.unit === "image") return "image";
  if (m.kind === "reference-to-video") return "video-ref";
  return "video";
}

export interface ModelInfo {
  id: string;
  label: string;
  unit: string;
  usd: number;
  tier: ModelTier;
  category: string;
  featured: boolean;
  kind: string;
  has4k: boolean;
  /** native audio generation supported (toggle should be shown) */
  hasAudio: boolean;
  /** audio raises the per-second price (vs. free audio like Seedance) */
  audioBilled: boolean;
  hasFast: boolean;
  hasNegative: boolean;
  /** accepts a seed — a one-variable re-roll can hold an identical base */
  hasSeed: boolean;
  qualities: string[];
  ratios: string[];
  durations: DurationSpec;
  numImages: { min: number; max: number };
  /** cannot run from text alone — needs ≥1 reference */
  requiresRef: boolean;
  refImages: number;
  refVideos: number;
  refAudio: number;
  refMedia: RefMedia;
  promptHint: string;
  notes: string;
}

function isVideoKind(m: ModelPricing): boolean {
  return m.unit === "video_second";
}

function durationFor(m: ModelPricing): DurationSpec {
  if (m.constraints?.duration) return m.constraints.duration;
  if (isVideoKind(m)) return { mode: "range", min: 4, max: 15, default: 5 };
  return { mode: "none" };
}

function ratiosFor(m: ModelPricing): string[] {
  if (m.constraints?.ratios?.length) return m.constraints.ratios;
  // A model that declares constraints but omits `ratios` has no aspect-ratio
  // control (e.g. edit models whose output follows the reference). Only fall
  // back to the family defaults for legacy entries that declare no constraints.
  if (m.constraints) return [];
  return m.unit === "image" ? IMAGE_RATIOS : VIDEO_RATIOS;
}

export function listModels(): ModelInfo[] {
  return Object.entries(FAL_MODELS).map(([id, m]) => {
    const kind = m.kind ?? (m.unit === "image" ? "text-to-image" : "text-to-video");
    return {
      id,
      label: m.label ?? id.replace("fal-ai/", ""),
      unit: m.unit,
      usd: m.usd,
      tier: (m.tier ?? "production") as ModelTier,
      category: m.category ?? defaultCategory(m),
      featured: m.featured === true,
      kind,
      has4k: m.tiers?.["4k"] !== undefined,
      hasAudio: m.constraints?.audio === true || m.audio_on !== undefined,
      audioBilled: m.audio_on !== undefined,
      hasFast: m.fast !== undefined,
      hasNegative: m.constraints?.negative === true,
      hasSeed: m.constraints?.seed === true,
      qualities: Object.keys(m.qualities ?? {}),
      ratios: ratiosFor(m),
      durations: durationFor(m),
      // "count" = how many to make in one go. Images batch into a single call;
      // video fires one clip per count (the composer loops). Default up to 4.
      numImages: m.constraints?.numImages ?? { min: 1, max: 4 },
      requiresRef:
        m.constraints?.requiresRef === true ||
        ["image-edit", "image-to-video", "reference-to-video"].includes(kind),
      refImages: m.refs?.images ?? 0,
      refVideos: m.refs?.videos ?? 0,
      refAudio: m.refs?.audio ?? 0,
      refMedia: { ...REF_MEDIA_DEFAULTS, ...(m.constraints?.refMedia ?? {}) },
      promptHint: m.promptHint ?? "",
      notes: m.notes ?? "",
    };
  });
}

let _byId: Map<string, ModelInfo> | null = null;
/** Cached single-model lookup for server routes and falInput. */
export function getModel(id: string): ModelInfo | undefined {
  if (!_byId) _byId = new Map(listModels().map((m) => [m.id, m]));
  return _byId.get(id);
}

export function modelUnit(model: string): string {
  return FAL_MODELS[model]?.unit ?? "image";
}

export function modelTier(model: string): ModelTier {
  return (FAL_MODELS[model]?.tier ?? "production") as ModelTier;
}

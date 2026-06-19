/**
 * Maps a generic job spec onto each fal model family's input schema
 * (verified against fal's model pages, Jun 2026).
 * Duration and aspect ratio are snapped to each model's native envelope via the
 * shared constraints in config/pricing.json (coerceSeconds / getModel), so the
 * payload can never disagree with the preflight estimate or the composer UI.
 * Params are stored on the job row, so any schema drift is visible in the ledger.
 */
import { getModel, coerceSeconds } from "@/lib/pricing";

export interface GenerateSpec {
  prompt: string;
  kind: "image" | "video";
  numImages: number;
  seconds: number;
  ratio: string;
  audio: boolean;
  fast: boolean;
  tier?: string; // "4k"
  quality?: string; // GPT Image 2: "low" | "medium" | "high"
  /** Reference media URLs (gallery blob URLs) for edit / i2v / ref2v models. */
  refImageUrls?: string[];
  refVideoUrls?: string[];
  refAudioUrls?: string[];
  /** Kling-family native artifact suppression. */
  negativePrompt?: string;
  /** Fixed seed for a locked-base one-variable re-roll. Only sent for models
   *  whose constraints declare `seed` (lib/pricing hasSeed) — the route gates it. */
  seed?: number;
}

const GPT_SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "square_hd",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "21:9": "landscape_16_9",
};

/** Seedance fast tiers are separate endpoints, not input flags. */
export function falEndpoint(model: string, spec: GenerateSpec): string {
  if (spec.fast && model.startsWith("bytedance/seedance-2.0/") && !model.includes("/fast/")) {
    return model.replace("bytedance/seedance-2.0/", "bytedance/seedance-2.0/fast/");
  }
  return model;
}

/** Snap the requested duration into the model's native envelope. */
function durationSeconds(model: string, spec: GenerateSpec): number {
  const info = getModel(model);
  const d = info?.durations ?? { mode: "range" as const, min: 4, max: 15 };
  return coerceSeconds(d, spec.seconds);
}

/** Pick a model-legal aspect ratio, falling back to its first allowed value. */
function aspectRatio(model: string, spec: GenerateSpec): string {
  const info = getModel(model);
  const allowed = info?.ratios ?? ["16:9", "9:16", "1:1"];
  return allowed.includes(spec.ratio) ? spec.ratio : allowed[0] ?? "16:9";
}

export function buildFalInput(model: string, spec: GenerateSpec): Record<string, unknown> {
  if (spec.kind === "image") {
    if (model.startsWith("openai/gpt-image-2")) {
      const input: Record<string, unknown> = {
        prompt: spec.prompt,
        num_images: spec.numImages,
        quality: spec.quality ?? "high",
        output_format: "png",
        image_size: spec.tier === "4k" ? { width: 3840, height: 2160 } : GPT_SIZE_BY_RATIO[spec.ratio] ?? "square_hd",
      };
      if (model.endsWith("/edit") && spec.refImageUrls?.length) {
        input.image_urls = spec.refImageUrls.slice(0, 10);
      }
      return input;
    }

    // FLUX Kontext — single-reference, prompt-driven in-context editing.
    if (model.startsWith("fal-ai/flux-pro/kontext")) {
      const input: Record<string, unknown> = {
        prompt: spec.prompt,
        num_images: spec.numImages,
        aspect_ratio: spec.ratio,
      };
      if (spec.refImageUrls?.[0]) input.image_url = spec.refImageUrls[0];
      return input;
    }

    // Qwen unified edit — 1..3 references cited by order in the prompt. Output
    // follows the references, so it takes no aspect_ratio.
    if (model.startsWith("fal-ai/qwen-image-2/edit")) {
      const input: Record<string, unknown> = {
        prompt: spec.prompt,
        num_images: spec.numImages,
      };
      if (spec.refImageUrls?.length) input.image_urls = spec.refImageUrls.slice(0, 3);
      return input;
    }

    // FLUX / Qwen text-to-image use image_size presets (same keys as GPT). These
    // accept a seed (constraints.seed) — passed for a locked-base re-roll.
    if (model.startsWith("fal-ai/flux") || model.startsWith("fal-ai/qwen-image")) {
      return {
        prompt: spec.prompt,
        num_images: spec.numImages,
        image_size: GPT_SIZE_BY_RATIO[spec.ratio] ?? "square_hd",
        ...(spec.seed != null ? { seed: spec.seed } : {}),
      };
    }

    // nano-banana family
    return {
      prompt: spec.prompt,
      num_images: spec.numImages,
      aspect_ratio: spec.ratio,
      ...(spec.tier === "4k" ? { resolution: "4K" } : {}),
    };
  }

  // Video families. NOTE: several models default generate_audio to TRUE,
  // which bills the higher audio rate — always set it explicitly.
  const secs = durationSeconds(model, spec);
  const ratio = aspectRatio(model, spec);

  if (model.includes("kling-video")) {
    // v2.5 turbo only takes discrete 5s / 10s; v3 is continuous 3-15s and adds audio.
    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      duration: String(secs),
      aspect_ratio: ratio,
    };
    if (model.includes("/v3/")) input.generate_audio = spec.audio;
    if (spec.negativePrompt?.trim()) input.negative_prompt = spec.negativePrompt.trim();
    if (model.includes("image-to-video") && spec.refImageUrls?.[0]) {
      input.image_url = spec.refImageUrls[0];
    }
    return input;
  }
  if (model.includes("hailuo-02")) {
    // MiniMax Hailuo-02 Pro: discrete 6s / 10s, 1080p.
    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      duration: String(secs),
      resolution: "1080p",
    };
    if (model.includes("image-to-video") && spec.refImageUrls?.[0]) {
      input.image_url = spec.refImageUrls[0];
    }
    return input;
  }
  if (model.includes("veo3")) {
    return {
      prompt: spec.prompt,
      duration: `${secs}s`,
      aspect_ratio: ratio,
      generate_audio: spec.audio,
      resolution: "720p",
    };
  }
  if (model.includes("seedance")) {
    const input: Record<string, unknown> = {
      prompt: spec.prompt,
      duration: String(secs),
      aspect_ratio: ratio,
      generate_audio: spec.audio,
      resolution: model.includes("reference-to-video") ? "1080p" : "720p",
    };
    if (model.includes("reference-to-video")) {
      if (spec.refImageUrls?.length) input.image_urls = spec.refImageUrls.slice(0, 9);
      if (spec.refVideoUrls?.length) input.video_urls = spec.refVideoUrls.slice(0, 3);
      if (spec.refAudioUrls?.length) input.audio_urls = spec.refAudioUrls.slice(0, 3);
    } else if (model.includes("image-to-video") && spec.refImageUrls?.[0]) {
      input.image_url = spec.refImageUrls[0];
    }
    return input;
  }
  // generic video fallback for any future family not matched above
  return {
    prompt: spec.prompt,
    duration: String(secs),
    aspect_ratio: ratio,
    resolution: "720p",
  };
}

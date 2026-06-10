/**
 * Maps a generic job spec onto each fal model family's input schema.
 * Params are stored on the job row, so any schema drift is visible in the ledger.
 */

export interface GenerateSpec {
  prompt: string;
  kind: "image" | "video";
  numImages: number;
  seconds: number;
  ratio: string;
  audio: boolean;
  fast: boolean;
  tier?: string; // "4k"
}

const FLUX_SIZE_BY_RATIO: Record<string, string> = {
  "1:1": "square_hd",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
};

export function buildFalInput(model: string, spec: GenerateSpec): Record<string, unknown> {
  if (spec.kind === "image") {
    if (model.includes("flux")) {
      return {
        prompt: spec.prompt,
        num_images: spec.numImages,
        image_size: FLUX_SIZE_BY_RATIO[spec.ratio] ?? "square_hd",
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

  // video families
  if (model.includes("kling")) {
    return {
      prompt: spec.prompt,
      duration: String(spec.seconds <= 5 ? 5 : 10),
      aspect_ratio: spec.ratio,
      ...(model.includes("3.0") && spec.audio ? { generate_audio: true } : {}),
    };
  }
  if (model.includes("veo")) {
    return {
      prompt: spec.prompt,
      duration: `${Math.min(Math.max(spec.seconds, 4), 8)}s`,
      aspect_ratio: spec.ratio,
      generate_audio: spec.audio,
    };
  }
  if (model.includes("seedance")) {
    return {
      prompt: spec.prompt,
      duration: spec.seconds,
      aspect_ratio: spec.ratio,
      ...(spec.fast ? { mode: "fast" } : {}),
    };
  }
  // wan and anything else: generic video schema
  return {
    prompt: spec.prompt,
    duration: spec.seconds,
    aspect_ratio: spec.ratio,
  };
}

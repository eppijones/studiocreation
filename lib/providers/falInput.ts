/**
 * Maps a generic job spec onto each fal model family's input schema
 * (verified against fal's OpenAPI schemas, Jun 2026).
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

/** Seedance fast is a separate endpoint, not an input flag. */
export function falEndpoint(model: string, spec: GenerateSpec): string {
  if (spec.fast && model === "bytedance/seedance-2.0/text-to-video") {
    return "bytedance/seedance-2.0/fast/text-to-video";
  }
  return model;
}

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

  // Video families. NOTE: several models default generate_audio to TRUE,
  // which bills the higher audio rate — always set it explicitly.
  const ratio3 = ["16:9", "9:16", "1:1"].includes(spec.ratio) ? spec.ratio : "16:9";

  if (model.includes("kling-video/v3")) {
    return {
      prompt: spec.prompt,
      duration: String(Math.min(Math.max(spec.seconds, 3), 15)),
      aspect_ratio: ratio3,
      generate_audio: spec.audio,
    };
  }
  if (model.includes("kling-video")) {
    return {
      prompt: spec.prompt,
      duration: spec.seconds <= 5 ? "5" : "10",
      aspect_ratio: ratio3,
    };
  }
  if (model.includes("veo3")) {
    const allowed = [4, 6, 8];
    const dur = allowed.reduce((a, b) =>
      Math.abs(b - spec.seconds) < Math.abs(a - spec.seconds) ? b : a
    );
    return {
      prompt: spec.prompt,
      duration: `${dur}s`,
      aspect_ratio: spec.ratio === "9:16" ? "9:16" : "16:9",
      generate_audio: spec.audio,
      resolution: "720p",
    };
  }
  if (model.includes("seedance")) {
    return {
      prompt: spec.prompt,
      duration: String(Math.min(Math.max(spec.seconds, 4), 15)),
      aspect_ratio: ratio3,
      generate_audio: spec.audio,
      resolution: "720p",
    };
  }
  // wan-25-preview and similar
  return {
    prompt: spec.prompt,
    duration: spec.seconds <= 5 ? "5" : "10",
    aspect_ratio: ratio3,
    resolution: "720p",
  };
}

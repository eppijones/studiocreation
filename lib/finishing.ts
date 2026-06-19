/**
 * Finishing pipeline: platform delivery presets + local ffmpeg export recipes
 * + fal finishing jobs (Topaz 4K upscale / frame interpolation).
 *
 * Cloud does the pixel-generation (upscale); ffmpeg does the packaging
 * (fps conform, crop, letterbox) locally at $0.
 */

export interface DeliveryPreset {
  id: string;
  label: string;
  /** target canvas */
  width: number;
  height: number;
  ratio: string;
  fps: number;
  /** crop = fill the frame, pad = letterbox/pillarbox */
  fit: "crop" | "pad";
  notes: string;
}

export const DELIVERY_PRESETS: DeliveryPreset[] = [
  { id: "tiktok", label: "TikTok / Reels / Shorts — 9:16", width: 1080, height: 1920, ratio: "9:16", fps: 30, fit: "crop", notes: "Vertical social. 30fps, crop-to-fill, keep hook in top 2/3 (UI safe zones)." },
  { id: "yt-4k-24", label: "YouTube 16:9 — 4K 24fps", width: 3840, height: 2160, ratio: "16:9", fps: 24, fit: "crop", notes: "Cinematic master. Upscale to 4K first, then conform." },
  { id: "yt-4k-25", label: "YouTube / Broadcast EU — 4K 25fps", width: 3840, height: 2160, ratio: "16:9", fps: 25, fit: "crop", notes: "PAL-land broadcast and EU clients." },
  { id: "yt-4k-30", label: "YouTube 16:9 — 4K 30fps", width: 3840, height: 2160, ratio: "16:9", fps: 30, fit: "crop", notes: "Standard web 4K." },
  { id: "yt-hd", label: "YouTube / X / FB — 1080p 30fps", width: 1920, height: 1080, ratio: "16:9", fps: 30, fit: "crop", notes: "Universal HD deliverable." },
  { id: "scope-24", label: "Cinemascope 2.35:1 — 24fps", width: 3840, height: 1634, ratio: "2.35:1", fps: 24, fit: "crop", notes: "Anamorphic-feel crop from a 16:9 or 21:9 master." },
  { id: "scope-letterbox", label: "Cinemascope letterboxed in 16:9 — 24fps", width: 3840, height: 2160, ratio: "16:9 (2.35:1 inside)", fps: 24, fit: "pad", notes: "Scope picture with black bars baked in — plays full-frame everywhere." },
  { id: "ig-feed", label: "Instagram feed — 4:5 30fps", width: 1080, height: 1350, ratio: "4:5", fps: 30, fit: "crop", notes: "Tallest feed placement on IG/FB." },
  { id: "square", label: "Square — 1:1 30fps", width: 1080, height: 1080, ratio: "1:1", fps: 30, fit: "crop", notes: "Feed-safe everywhere." },
];

/**
 * Optional $0 color grade — built-in ffmpeg filters only (no external LUT
 * files), so the recipe stays portable and free. Applied before scaling.
 */
export interface ColorLook {
  id: string;
  label: string;
  /** ffmpeg filtergraph fragment, or "" for no grade. */
  vf: string;
}

export const COLOR_LOOKS: ColorLook[] = [
  { id: "none", label: "As-is", vf: "" },
  { id: "teal-orange", label: "Teal & orange", vf: "colorbalance=bs=0.12:rs=-0.06:rh=0.10:bh=-0.08,eq=saturation=1.12:contrast=1.06" },
  { id: "warm", label: "Warm filmic", vf: "colorbalance=rm=0.06:bm=-0.04,eq=saturation=1.08:contrast=1.04:gamma=1.02" },
  { id: "cool", label: "Cool noir", vf: "eq=saturation=0.72:contrast=1.18:brightness=-0.02,colorbalance=bs=0.08:bh=0.05" },
  { id: "vibrant", label: "Punchy", vf: "eq=saturation=1.25:contrast=1.08:gamma=1.01" },
  { id: "bw", label: "B&W", vf: "hue=s=0,eq=contrast=1.12" },
];

/** The filtergraph fragment for a look id ("" when none / unknown). */
export function lookVf(lookId: string | undefined): string {
  return COLOR_LOOKS.find((l) => l.id === lookId)?.vf ?? "";
}

/** Local, $0 packaging step. Assumes the source is already the quality master.
 *  `grade` is an optional COLOR_LOOK vf fragment, applied before the scale. */
export function ffmpegCommand(preset: DeliveryPreset, sourceUrl: string, outName: string, grade = ""): string {
  const { width: w, height: h, fps } = preset;
  let vf: string;
  if (preset.id === "scope-letterbox") {
    // scope picture (3840x1634) centered on a 16:9 canvas
    vf = `scale=3840:1634:force_original_aspect_ratio=increase,crop=3840:1634,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`;
  } else if (preset.fit === "pad") {
    vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`;
  } else {
    vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps}`;
  }
  if (grade) vf = `${grade},${vf}`;
  return [
    `ffmpeg -i "${sourceUrl}"`,
    `-vf "${vf}"`,
    `-r ${fps} -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p`,
    `-c:a aac -b:a 192k -movflags +faststart`,
    `"${outName}"`,
  ].join(" \\\n  ");
}

export function ffmpegImageCommand(preset: DeliveryPreset, sourceUrl: string, outName: string, grade = ""): string {
  const { width: w, height: h } = preset;
  let vf =
    preset.fit === "pad"
      ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
      : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  if (grade) vf = `${grade},${vf}`;
  return `ffmpeg -i "${sourceUrl}" -vf "${vf}" -q:v 1 "${outName}"`;
}

export type FinishAction = "upscale-video-4k" | "upscale-image-4k" | "upscale-image-crisp";

export interface FinishPlan {
  action: FinishAction;
  model: string;
  label: string;
  input: Record<string, unknown>;
  /** unit count for the estimator (seconds for video, 1 for image) */
  count: number;
}

export function buildFinishPlan(
  action: FinishAction,
  sourceUrl: string,
  opts: { durationS?: number | null; targetFps?: number; upscaleFactor?: number }
): FinishPlan {
  const factor = Math.min(Math.max(opts.upscaleFactor ?? 2, 1), 4);
  if (action === "upscale-video-4k") {
    const input: Record<string, unknown> = {
      video_url: sourceUrl,
      model: "Proteus",
      upscale_factor: factor,
      H264_output: true,
    };
    if (opts.targetFps) input.target_fps = Math.min(Math.max(opts.targetFps, 16), 60);
    return {
      action,
      model: "fal-ai/topaz/upscale/video",
      label: `4k-${opts.targetFps ?? "native"}fps`,
      input,
      count: Math.max(Math.ceil(opts.durationS ?? 5), 1),
    };
  }
  if (action === "upscale-image-4k") {
    return {
      action,
      model: "fal-ai/topaz/upscale/image",
      label: "4k-print",
      input: { image_url: sourceUrl, upscale_factor: factor },
      count: 1,
    };
  }
  return {
    action,
    model: "fal-ai/recraft/upscale/crisp",
    label: "crisp-2x",
    input: { image_url: sourceUrl },
    count: 1,
  };
}

/**
 * Encoder resolver — picks the active backend from config (LIBRARY_ENCODER).
 * Dev = videotoolbox; Oslo flips to nvenc. The crawler/worker ask here.
 */
import type { Encoder } from "./types";
import { VideoToolboxEncoder } from "./videotoolbox";
import { NvencEncoder } from "./nvenc";
import { WindowsFfmpegEncoder } from "./windows-ffmpeg";
import { LIBRARY_ENCODER, type EncoderId } from "../config/index";

export type { Encoder, VideoEncodeRequest } from "./types";

export function makeEncoder(id: EncoderId = LIBRARY_ENCODER): Encoder {
  switch (id) {
    case "nvenc":
      return new NvencEncoder();
    case "windows-ffmpeg":
      return new WindowsFfmpegEncoder();
    case "videotoolbox":
    default:
      return new VideoToolboxEncoder();
  }
}

/** The active encoder per config. */
export const encoder: Encoder = makeEncoder();

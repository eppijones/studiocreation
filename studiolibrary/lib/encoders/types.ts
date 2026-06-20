/**
 * Encoder adapter — the SECOND hard abstraction.
 *
 * Only the VIDEO PROXY re-encode is hardware/codec specific. The adapter's job
 * is to supply the ffmpeg video-codec args for the active backend
 * (videotoolbox on Mac, nvenc on the A6000, software x264 as the Windows
 * fallback). Poster / sprite / waveform / page-preview are codec-agnostic
 * ffmpeg filters and live in ../media/thumbnails.ts — they don't vary by GPU.
 */
import type { EncoderId } from "../config/index";

export interface VideoEncodeRequest {
  /** Target max height (e.g. 1080); width scales to keep aspect, even dims. */
  maxHeight: number;
  bitrate: string; // "6M"
  maxrate: string; // "9M"
  /** Keyframe interval in frames (dense GOP → snap-seek). */
  gopFrames: number;
}

export interface Encoder {
  readonly id: EncoderId;
  /** Is this backend usable on the current host? (codec present, GPU up.) */
  available(): Promise<boolean>;
  /** Optional ffmpeg input/global args (e.g. hardware-accelerated decode). */
  inputArgs(): string[];
  /** ffmpeg output args for the video stream: `-c:v ...` + tuning. */
  videoArgs(req: VideoEncodeRequest): string[];
  /** Reported codec name written into the proxies row. */
  readonly codecName: string;
}

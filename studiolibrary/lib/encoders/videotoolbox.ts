/**
 * VideoToolbox encoder — Apple Silicon hardware H.264 (Phase 0, the Mac).
 * Smoke-tested at ~7× realtime on the test fixtures.
 */
import { spawnSync } from "node:child_process";
import type { Encoder, VideoEncodeRequest } from "./types";

export class VideoToolboxEncoder implements Encoder {
  readonly id = "videotoolbox" as const;
  readonly codecName = "h264";

  async available(): Promise<boolean> {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
    return (r.stdout ?? "").includes("h264_videotoolbox");
  }

  inputArgs(): string[] {
    return [];
  }

  videoArgs(req: VideoEncodeRequest): string[] {
    return [
      "-c:v", "h264_videotoolbox",
      "-b:v", req.bitrate,
      "-maxrate", req.maxrate,
      "-g", String(req.gopFrames),
      "-pix_fmt", "yuv420p",
      // avc1 tag → broad browser playback in <video>.
      "-tag:v", "avc1",
      "-movflags", "+faststart",
    ];
  }
}

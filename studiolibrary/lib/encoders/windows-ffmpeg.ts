/**
 * Software x264 encoder — the universal fallback (e.g. Windows `ffmpeg.exe`
 * with no working NVENC, or any host lacking hardware encode). Slower, but it
 * always works, so the pipeline never hard-stops on a missing GPU.
 */
import { spawnSync } from "node:child_process";
import type { Encoder, VideoEncodeRequest } from "./types";

export class WindowsFfmpegEncoder implements Encoder {
  readonly id = "windows-ffmpeg" as const;
  readonly codecName = "h264";

  async available(): Promise<boolean> {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
    return (r.stdout ?? "").includes("libx264");
  }

  inputArgs(): string[] {
    return [];
  }

  videoArgs(req: VideoEncodeRequest): string[] {
    return [
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "21",
      "-maxrate", req.maxrate,
      "-bufsize", req.maxrate,
      "-g", String(req.gopFrames),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
    ];
  }
}

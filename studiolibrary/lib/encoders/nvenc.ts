/**
 * NVENC encoder — Oslo (prod) GPU H.264 on the RTX A6000 (or 4090).
 *
 * STUB for Phase 0 (no NVIDIA hardware on the Mac) but the args are real, so
 * the Oslo flip is purely LIBRARY_ENCODER=nvenc. Build is GPU-agnostic: the
 * A6000 (unrestricted NVENC sessions, 48GB) and the 4090 (8-session cap, AV1)
 * both expose `h264_nvenc`, with NVDEC decode via `-hwaccel cuda`. Run the GPU
 * smoke test (`nvidia-smi`, an h264_nvenc encode well above realtime) before
 * pointing the pipeline at it.
 */
import { spawnSync } from "node:child_process";
import type { Encoder, VideoEncodeRequest } from "./types";

export class NvencEncoder implements Encoder {
  readonly id = "nvenc" as const;
  readonly codecName = "h264";

  async available(): Promise<boolean> {
    // Both the encoder must be compiled in AND a GPU must answer nvidia-smi.
    const enc = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" });
    if (!(enc.stdout ?? "").includes("h264_nvenc")) return false;
    const smi = spawnSync("nvidia-smi", ["-L"], { encoding: "utf8" });
    return smi.status === 0 && /GPU \d+:/.test(smi.stdout ?? "");
  }

  inputArgs(): string[] {
    // NVDEC hardware decode keeps the whole transcode on-GPU.
    return ["-hwaccel", "cuda"];
  }

  videoArgs(req: VideoEncodeRequest): string[] {
    return [
      "-c:v", "h264_nvenc",
      "-preset", "p4",
      "-tune", "hq",
      "-rc", "vbr",
      "-b:v", req.bitrate,
      "-maxrate", req.maxrate,
      "-g", String(req.gopFrames),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
    ];
  }
}

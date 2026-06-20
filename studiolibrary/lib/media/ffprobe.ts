/** ffprobe wrapper — container/codec/duration/resolution/fps for any asset. */
import { spawn } from "node:child_process";

export interface ProbeResult {
  container: string | null;
  codec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
  fps: number | null;
}

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    p.on("error", () => resolve({ code: 1, stdout, stderr }));
  });
}

function parseFps(rate: string | undefined): number | null {
  if (!rate) return null;
  const [n, d] = rate.split("/").map(Number);
  if (!n || !d) return null;
  return Math.round((n / d) * 1000) / 1000;
}

export async function ffprobe(absPath: string): Promise<ProbeResult> {
  const { code, stdout } = await run("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    absPath,
  ]);
  const empty: ProbeResult = {
    container: null, codec: null, audioCodec: null,
    width: null, height: null, durationS: null, fps: null,
  };
  if (code !== 0 || !stdout) return empty;

  let json: {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{
      codec_type?: string; codec_name?: string;
      width?: number; height?: number;
      avg_frame_rate?: string; r_frame_rate?: string; duration?: string;
    }>;
  };
  try {
    json = JSON.parse(stdout);
  } catch {
    return empty;
  }

  const streams = json.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  const durationStr = json.format?.duration ?? v?.duration ?? a?.duration;

  return {
    container: json.format?.format_name?.split(",")[0] ?? null,
    codec: v?.codec_name ?? null,
    audioCodec: a?.codec_name ?? null,
    width: v?.width ?? null,
    height: v?.height ?? null,
    durationS: durationStr ? Math.round(Number(durationStr) * 1000) / 1000 : null,
    fps: parseFps(v?.avg_frame_rate) ?? parseFps(v?.r_frame_rate),
  };
}

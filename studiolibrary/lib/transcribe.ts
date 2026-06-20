/**
 * Transcription step — runs local Whisper (faster-whisper) over an audio/video
 * asset, stores the transcript (searchable full-text + timed segments) and
 * writes SRT + VTT sidecars into the proxy dir. Local + offline; API fallback
 * is off by design. In Oslo the same path runs on the A6000 (WHISPER_DEVICE=cuda).
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { WHISPER, PROXY_ROOT } from "./config/index";
import type { Volume } from "./volumes/types";
import {
  upsertTranscript, setAssetStatus, type AssetRow, type TranscriptSegment,
} from "./repo";

interface WhisperOut {
  language?: string;
  duration?: number;
  full_text?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

function runWhisper(mediaPath: string): Promise<WhisperOut> {
  return new Promise((resolve) => {
    const p = spawn(WHISPER.python, [WHISPER.script, mediaPath, WHISPER.model, WHISPER.device]);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => resolve({ error: `spawn failed: ${e.message}` }));
    p.on("close", () => {
      try {
        resolve(JSON.parse(stdout.trim().split("\n").pop() || "{}"));
      } catch {
        resolve({ error: `unparseable output: ${stderr.slice(-400) || stdout.slice(-400)}` });
      }
    });
  });
}

function ts(seconds: number, comma: boolean): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? "," : "."}${pad(ms, 3)}`;
}

export function toSRT(segs: TranscriptSegment[]): string {
  return segs.map((s, i) => `${i + 1}\n${ts(s.start, true)} --> ${ts(s.end, true)}\n${s.text}\n`).join("\n");
}
export function toVTT(segs: TranscriptSegment[]): string {
  return "WEBVTT\n\n" + segs.map((s) => `${ts(s.start, false)} --> ${ts(s.end, false)}\n${s.text}\n`).join("\n");
}

/** Save hand-edited subtitle cues back to the transcript + rewrite SRT/VTT. */
export async function saveTranscriptEdits(
  assetId: number, segments: TranscriptSegment[], language: string | null
): Promise<void> {
  const fullText = segments.map((s) => s.text.trim()).filter(Boolean).join(" ");
  await upsertTranscript(assetId, { language, full_text: fullText, segments });
  const dir = join(PROXY_ROOT, String(assetId));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "captions.srt"), toSRT(segments));
  await writeFile(join(dir, "captions.vtt"), toVTT(segments));
}

/** Transcribe one asset. Returns true if a transcript was produced. */
export async function transcribeAsset(asset: AssetRow, volume: Volume): Promise<boolean> {
  if (asset.kind !== "audio" && asset.kind !== "video") return false;
  // Nothing to transcribe if the video carries no audio track — skip cleanly
  // (faster-whisper's decoder throws on an absent audio stream otherwise).
  if (asset.kind === "video" && !asset.audio_codec) {
    await setAssetStatus(asset.id, "enriched");
    return false;
  }
  const src = volume.absPath(asset.rel_path);
  const out = await runWhisper(src);
  if (out.error) throw new Error(out.error);

  const segments = out.segments ?? [];
  const fullText = (out.full_text ?? "").trim();
  await upsertTranscript(asset.id, {
    language: out.language ?? null,
    full_text: fullText,
    segments,
  });

  // SRT + VTT sidecars in the proxy dir (the player can wire a <track> later).
  if (segments.length) {
    const dir = join(PROXY_ROOT, String(asset.id));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "captions.srt"), toSRT(segments));
    await writeFile(join(dir, "captions.vtt"), toVTT(segments));
  }

  await setAssetStatus(asset.id, "enriched");
  return fullText.length > 0 || segments.length > 0;
}

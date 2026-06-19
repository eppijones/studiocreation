"use client";

/** Trim & edit — pull a fitting section out of an over-limit clip. A dual-handle
 *  timeline over a live preview; the cut runs server-side via local ffmpeg, and
 *  falls back to an in-browser re-encode when ffmpeg isn't on the host. The result
 *  registers as a $0 reference, exactly like a plain upload. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn } from "../components/ui";
import { Icon } from "../components/Icon";
import { type RefAsset } from "./types";

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

// Browser fallback: re-record the selected window via the video's own captureStream.
// Real-time and re-encoded (webm), but dependency-free and works anywhere.
function trimInBrowser(file: File, start: number, end: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read this video in the browser"));
    };
    video.onloadedmetadata = () => {
      type Capturable = HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const v = video as Capturable;
      const grab = v.captureStream?.bind(v) ?? v.mozCaptureStream?.bind(v);
      if (!grab) {
        cleanup();
        reject(new Error("This browser can't trim locally — try a machine with ffmpeg"));
        return;
      }
      video.currentTime = start;
      video.onseeked = () => {
        video.onseeked = null;
        const stream = grab();
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm";
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
        const onTime = () => {
          if (video.currentTime >= end) {
            video.removeEventListener("timeupdate", onTime);
            video.pause();
            if (rec.state === "recording") rec.stop();
          }
        };
        rec.start();
        video.addEventListener("timeupdate", onTime);
        video.play().catch(() => {
          video.removeEventListener("timeupdate", onTime);
          if (rec.state === "recording") rec.stop();
        });
      };
    };
  });
}

export function TrimModal({
  file,
  maxSec,
  maxMB,
  model,
  project,
  onCancel,
  onComplete,
}: {
  file: File;
  maxSec: number;
  maxMB: number;
  model: string;
  project: string;
  onCancel: () => void;
  onComplete: (assets: RefAsset[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const url = useRef<string>("");
  if (!url.current) url.current = URL.createObjectURL(file);

  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const MIN = 0.5;
  const sel = Math.max(0, end - start);
  const overMB = file.size / 1024 / 1024 > maxMB;

  useEffect(() => {
    return () => {
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const onMeta = () => {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    const e = Math.min(maxSec, d);
    setStart(0);
    setEnd(e);
    setPlayhead(0);
  };

  // Loop playback inside the selection so the preview shows exactly the cut.
  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= end) {
      v.currentTime = start;
    }
    setPlayhead(v.currentTime);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start;
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
    setPlayhead(t);
  };

  const pctOf = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return 0;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return pct * duration;
  };

  const dragHandle = (which: "start" | "end") => (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    const t = timeAt(e.clientX);
    if (which === "start") {
      const s = Math.min(Math.max(0, Math.max(t, end - maxSec)), end - MIN);
      setStart(s);
      seek(s);
    } else {
      const en = Math.max(Math.min(duration, Math.min(t, start + maxSec)), start + MIN);
      setEnd(en);
      seek(en);
    }
  };

  const confirm = useCallback(async () => {
    if (busy || sel <= 0) return;
    setBusy(true);
    setError(null);
    try {
      // 1) Server ffmpeg — fast, exact, lossless-ish mp4.
      setStage("Trimming with ffmpeg…");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("start", String(start));
      fd.append("duration", String(sel));
      fd.append("model", model);
      fd.append("project", project);
      let res = await fetch("/api/uploads/trim", { method: "POST", body: fd });

      if (res.status === 501) {
        // 2) Fallback — re-encode the window in the browser, then upload normally.
        setStage("Trimming in your browser…");
        const blob = await trimInBrowser(file, start, start + sel);
        const trimmedName = `${(file.name || "clip").replace(/\.[^.]+$/, "")}-trim.webm`;
        const trimmedFile = new File([blob], trimmedName, { type: "video/webm" });
        setStage("Uploading…");
        const up = new FormData();
        up.append("files", trimmedFile);
        up.append("model", model);
        up.append("project", project);
        res = await fetch("/api/uploads", { method: "POST", body: up });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Trim failed");
      const assets = (data.assets ?? []) as RefAsset[];
      if (assets.length === 0) throw new Error("No clip came back");
      onComplete(assets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trim failed");
      setBusy(false);
      setStage("");
    }
  }, [busy, sel, file, start, model, project, onComplete]);

  const fits = sel <= maxSec + 0.05 && sel >= MIN;

  return (
    <div className="trim-overlay">
      <div className="trim-dim" onClick={() => !busy && onCancel()} />
      <div className="trim-card" role="dialog" aria-label="Trim clip">
        <div className="trim-head">
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <span className="trim-title">Trim to fit</span>
            <span className="t-xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name || "clip"} · {overMB ? "over size — " : ""}pick up to {maxSec}s
            </span>
          </div>
          <button className="icon-btn ghost" aria-label="Close" onClick={() => !busy && onCancel()}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="trim-stage">
          <video
            ref={videoRef}
            className="trim-video"
            src={url.current}
            playsInline
            onLoadedMetadata={onMeta}
            onTimeUpdate={onTime}
            onClick={togglePlay}
            onEnded={() => setPlaying(false)}
          />
          <button className="trim-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play selection"}>
            <Icon name={playing ? "compress" : "play"} size={playing ? 18 : 20} />
          </button>
        </div>

        {/* TIMELINE — drag the handles; the lit band is what you'll keep */}
        <div className="trim-time">
          <div
            className="trim-track"
            ref={trackRef}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest(".trim-handle")) return;
              seek(timeAt(e.clientX));
            }}
          >
            <div className="trim-sel" style={{ left: `${pctOf(start)}%`, width: `${pctOf(sel)}%` }} />
            <div className="trim-playhead" style={{ left: `${pctOf(playhead)}%` }} />
            <button
              className="trim-handle s"
              style={{ left: `${pctOf(start)}%` }}
              aria-label="Selection start"
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={dragHandle("start")}
            >
              <span />
            </button>
            <button
              className="trim-handle e"
              style={{ left: `${pctOf(end)}%` }}
              aria-label="Selection end"
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={dragHandle("end")}
            >
              <span />
            </button>
          </div>
          <div className="trim-scale mono t-xs muted">
            <span>{fmt(start)}</span>
            <span className={`trim-seln ${fits ? "ok" : "bad"}`}>
              {fmt(sel)} selected{fits ? "" : ` · max ${maxSec}s`}
            </span>
            <span>{fmt(end)}</span>
          </div>
        </div>

        {error && <p className="err" style={{ margin: "2px 0 0" }}>⚠️ {error}</p>}

        <div className="trim-foot">
          <span className="t-xs muted">{busy ? stage : "Local ffmpeg, or in-browser if it's not installed"}</span>
          <div className="row gap2">
            <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Btn>
            <Btn variant="primary" size="sm" onClick={confirm} disabled={busy || !fits}>
              {busy ? "Working…" : "Use this section"}
              {!busy && <Icon name="check" size={14} />}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/* COMPARE — side-by-side video take/version selection.
   Reads asset ids from ?ids=4,5 (2–4 clamp), fetches each asset, keeps only
   videos with a ready video_proxy, then plays them in a synced grid.
   Sync mode: one master transport drives every player (play/pause/seek +
   frame-step at the smallest fps). Independent mode: native controls per
   player, free-running. Serves PROXIES ONLY. */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "../../components/Icon";
import styles from "./compare.module.css";

/* ── data shapes (subset of the asset detail payload) ─────────────────── */
interface Proxy {
  kind: string;
  status: string;
}
interface AssetMeta {
  id: number;
  kind: string;
  filename: string;
  fps: number | null;
  duration_s: number | null;
  review_state: string | null;
}
interface AssetResponse {
  asset: AssetMeta;
  proxies: Proxy[];
}

/* a clip that passed the filter (video + ready video_proxy) */
interface Clip {
  id: number;
  filename: string;
  fps: number;
  duration_s: number;
  review_state: string | null;
}

function media(id: number, kind: string): string {
  return `/api/library/media/${id}/${kind}`;
}

/* parse "4,5" → [4,5], dedupe, clamp count to 2–4 */
function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out.slice(0, 4);
}

function fmtClock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/* review-state → token colour for the small label under each player */
function stateClass(state: string | null): string {
  switch (state) {
    case "approved":
    case "delivered":
      return styles.stOk;
    case "flagged":
      return styles.stWarn;
    case "hidden":
    case "rejected":
      return styles.stBad;
    default:
      return styles.stNeutral;
  }
}

export default function CompareGate() {
  return (
    <Suspense fallback={<div className={styles.wrap}><p className={styles.muted}>Loading…</p></div>}>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const params = useSearchParams();
  const ids = parseIds(params.get("ids"));

  const [clips, setClips] = useState<Clip[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (ids.length === 0) {
      setClips([]);
      return;
    }
    let live = true;
    Promise.all(
      ids.map((id) =>
        fetch(`/api/library/assets/${id}`)
          .then((r) => (r.ok ? (r.json() as Promise<AssetResponse>) : Promise.reject()))
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (!live) return;
        const kept: Clip[] = [];
        for (const res of results) {
          if (!res || res.asset.kind !== "video") continue;
          const hasProxy = res.proxies.some(
            (p) => p.kind === "video_proxy" && p.status === "ready",
          );
          if (!hasProxy) continue;
          kept.push({
            id: res.asset.id,
            filename: res.asset.filename,
            fps: res.asset.fps ?? 25,
            duration_s: res.asset.duration_s ?? 0,
            review_state: res.asset.review_state ?? null,
          });
        }
        setClips(kept);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
    // ids is derived from the query string; depend on its serialised form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("ids")]);

  return (
    <div className={styles.wrap}>
      <Header count={clips?.length ?? 0} />
      {clips === null && !error && <p className={styles.muted}>Loading clips…</p>}
      {error && <p className={styles.muted}>Could not load these assets.</p>}
      {clips !== null && clips.length < 2 && <EmptyState />}
      {clips !== null && clips.length >= 2 && <Grid clips={clips} />}
    </div>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div className={styles.header}>
      <Link href="/library" className={styles.back}>
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} /> Media Library
      </Link>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>COMPARE</h1>
        {count > 0 && (
          <span className={styles.count}>
            ({count} {count === 1 ? "clip" : "clips"})
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <Icon name="film" size={40} />
      <p className={styles.emptyTitle}>Need at least two video clips to compare.</p>
      <p className={styles.muted}>
        Open a few takes from the library and pick &ldquo;Compare&rdquo;, or pass{" "}
        <code className={styles.code}>?ids=4,5</code> (2&ndash;4 video ids).
      </p>
      <Link href="/library" className={styles.backBtn}>
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to Media Library
      </Link>
    </div>
  );
}

/* ── the synced player grid ───────────────────────────────────────────── */
function Grid({ clips }: { clips: Clip[] }) {
  const n = clips.length;
  const refs = useRef<(HTMLVideoElement | null)[]>([]);

  const [sync, setSync] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [tc, setTc] = useState(0);
  /* exactly one clip unmuted by default; user may toggle freely */
  const [unmuted, setUnmuted] = useState<Set<number>>(() => new Set([0]));

  const maxDuration = Math.max(0, ...clips.map((c) => c.duration_s));
  const minFps = Math.max(1, Math.min(...clips.map((c) => c.fps)));
  const frameStep = 1 / minFps;

  const eachVideo = useCallback((fn: (v: HTMLVideoElement) => void) => {
    for (const v of refs.current) {
      if (v) fn(v);
    }
  }, []);

  /* drive the master readout off the first player's timeupdate (no loop:
     this only READS currentTime and writes to React state) */
  useEffect(() => {
    if (!sync) return;
    const lead = refs.current[0];
    if (!lead) return;
    const tick = () => setTc(lead.currentTime);
    lead.addEventListener("timeupdate", tick);
    return () => lead.removeEventListener("timeupdate", tick);
  }, [sync, n]);

  /* leaving sync mode: stop everyone so native controls take over cleanly */
  useEffect(() => {
    if (!sync) {
      eachVideo((v) => v.pause());
      setPlaying(false);
    }
  }, [sync, eachVideo]);

  const masterPlay = useCallback(() => {
    eachVideo((v) => {
      v.play().catch(() => {});
    });
    setPlaying(true);
  }, [eachVideo]);

  const masterPause = useCallback(() => {
    eachVideo((v) => v.pause());
    setPlaying(false);
  }, [eachVideo]);

  const togglePlay = useCallback(() => {
    if (playing) masterPause();
    else masterPlay();
  }, [playing, masterPlay, masterPause]);

  const seekAll = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(maxDuration, t));
      eachVideo((v) => {
        v.currentTime = clamped;
      });
      setTc(clamped);
    },
    [eachVideo, maxDuration],
  );

  const stepFrame = useCallback(
    (dir: number) => {
      const lead = refs.current[0];
      const base = lead ? lead.currentTime : tc;
      eachVideo((v) => v.pause());
      setPlaying(false);
      seekAll(base + dir * frameStep);
    },
    [eachVideo, frameStep, seekAll, tc],
  );

  const toggleMute = (idx: number) => {
    setUnmuted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const gridClass = `${styles.grid} ${n === 2 ? styles.grid2 : styles.gridQuad}`;

  return (
    <>
      <Toolbar
        sync={sync}
        onToggleSync={() => setSync((s) => !s)}
        playing={playing}
        onTogglePlay={togglePlay}
        tc={tc}
        maxDuration={maxDuration}
        onSeek={seekAll}
        onStep={stepFrame}
        minFps={minFps}
      />

      <div className={gridClass}>
        {clips.map((clip, idx) => (
          <div key={clip.id} className={styles.cell}>
            <div className={styles.playerWrap}>
              <video
                ref={(el) => {
                  refs.current[idx] = el;
                }}
                className={styles.video}
                src={media(clip.id, "video_proxy")}
                poster={media(clip.id, "poster")}
                muted={!unmuted.has(idx)}
                controls={!sync}
                playsInline
                preload="metadata"
              />
              <div className={styles.cellBadge}>{String.fromCharCode(65 + idx)}</div>
              <button
                className={`${styles.muteBtn} ${unmuted.has(idx) ? styles.muteOn : ""}`}
                onClick={() => toggleMute(idx)}
                title={unmuted.has(idx) ? "Mute audio" : "Unmute audio"}
                aria-pressed={unmuted.has(idx)}
              >
                <Icon name={unmuted.has(idx) ? "audio" : "eyeoff"} size={14} />
              </button>
            </div>
            <div className={styles.cellFoot}>
              <span className={styles.filename} title={clip.filename}>
                {clip.filename}
              </span>
              <span className={`${styles.stateLabel} ${stateClass(clip.review_state)}`}>
                {clip.review_state ?? "new"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── master transport / sync controls ─────────────────────────────────── */
function Toolbar({
  sync,
  onToggleSync,
  playing,
  onTogglePlay,
  tc,
  maxDuration,
  onSeek,
  onStep,
  minFps,
}: {
  sync: boolean;
  onToggleSync: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  tc: number;
  maxDuration: number;
  onSeek: (t: number) => void;
  onStep: (dir: number) => void;
  minFps: number;
}) {
  return (
    <div className={styles.toolbar}>
      <button
        className={`${styles.modeToggle} ${sync ? styles.modeOn : ""}`}
        onClick={onToggleSync}
        title="Toggle synced playback"
        aria-pressed={sync}
      >
        <Icon name={sync ? "layers" : "gallery"} size={14} />
        {sync ? "Sync" : "Independent"}
      </button>

      {sync && (
        <div className={styles.transport}>
          <button className={styles.iconBtn} onClick={() => onStep(-1)} title="Step back one frame">
            <Icon name="chevronRight" size={15} style={{ transform: "rotate(180deg)" }} />
          </button>
          <button className={styles.playBtn} onClick={onTogglePlay} title={playing ? "Pause all" : "Play all"}>
            <Icon name={playing ? "pause" : "play"} size={16} />
          </button>
          <button className={styles.iconBtn} onClick={() => onStep(1)} title="Step forward one frame">
            <Icon name="chevronRight" size={15} />
          </button>

          <input
            className={styles.scrub}
            type="range"
            min={0}
            max={maxDuration || 0}
            step={0.01}
            value={Math.min(tc, maxDuration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Master scrub"
          />

          <span className={styles.readout}>
            {fmtClock(tc)} / {fmtClock(maxDuration)}
          </span>
          <span className={styles.fpsTag}>{minFps} fps step</span>
        </div>
      )}

      {!sync && (
        <span className={styles.hint}>
          <Icon name="play" size={12} /> Independent — each clip runs free with its own controls.
        </span>
      )}
    </div>
  );
}

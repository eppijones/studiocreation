"use client";

import { useEffect, useState } from "react";

/* Reusable hover-scrub primitive shared by the cards, the gallery filmstrip and
   the columns thumbs. The proxy pipeline already builds a sprite sheet per video
   (config preset cols:5 / 40 frames) and serves it at /api/library/media/<id>/sprite;
   its grid lives in proxies.meta. We fetch that meta lazily on first hover (cached
   per id) and position the sheet by PERCENTAGE so it scales to any thumbnail size. */

export interface SpriteMeta { cols: number; rows: number; count: number; }

// id → meta (null = no sprite available). Module-level so it survives re-mounts.
const cache = new Map<number, SpriteMeta | null>();

/** Lazily resolve a video's sprite grid the first time it's hovered. Uses a
    lightweight meta-only endpoint and only caches POSITIVE results, so a clip
    whose proxy isn't built yet is retried on a later hover (not cached as null). */
export function useSpriteMeta(id: number, enabled: boolean): SpriteMeta | null {
  const [meta, setMeta] = useState<SpriteMeta | null>(() => cache.get(id) ?? null);
  useEffect(() => {
    if (!enabled) return;
    const cached = cache.get(id);
    if (cached) { setMeta(cached); return; }
    let cancelled = false;
    fetch(`/api/library/sprite/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d?.sprite;
        const out: SpriteMeta | null = s && Number(s.cols) > 0 && Number(s.count) > 0
          ? { cols: Number(s.cols), rows: Number(s.rows) || Math.ceil(Number(s.count) / Number(s.cols)), count: Number(s.count) }
          : null;
        if (out) cache.set(id, out);
        if (!cancelled) setMeta(out);
      })
      .catch(() => { if (!cancelled) setMeta(null); });
    return () => { cancelled = true; };
  }, [id, enabled]);
  return meta;
}

/** Frame index (0..count-1) for a 0..1 cursor ratio across the thumb. */
export function frameFromRatio(meta: SpriteMeta, ratio: number): number {
  return Math.min(meta.count - 1, Math.max(0, Math.floor(ratio * meta.count)));
}

/** Background style that shows one sprite tile, scaled to fill the container. */
export function spriteStyle(meta: SpriteMeta, frame: number, id: number): React.CSSProperties {
  const col = frame % meta.cols;
  const row = Math.floor(frame / meta.cols);
  const cx = meta.cols > 1 ? (col / (meta.cols - 1)) * 100 : 0;
  const cy = meta.rows > 1 ? (row / (meta.rows - 1)) * 100 : 0;
  return {
    backgroundImage: `url(/api/library/media/${id}/sprite)`,
    backgroundSize: `${meta.cols * 100}% ${meta.rows * 100}%`,
    backgroundPosition: `${cx}% ${cy}%`,
    backgroundRepeat: "no-repeat",
  };
}

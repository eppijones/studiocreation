"use client";

/** Shared assets cache. Multiple surfaces (Showcase, Create's reference pool, the
 *  gallery, …) all read GET /api/assets — without a shared cache each fires its own
 *  request on mount (the refetch waterfall). This dedupes to ONE in-flight request,
 *  hands every subscriber the cached list immediately, and lets any of them revalidate. */
import { useCallback, useEffect, useState } from "react";

export interface StudioAsset {
  id: number;
  job_id: number;
  blob_url: string;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  status: string;
  project: string;
  label: string;
  prompt: string;
  model: string;
  created_at: string;
  tags?: string[];
}

let cache: StudioAsset[] | null = null;
let inflight: Promise<StudioAsset[]> | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

/** Fetch (or reuse) the asset list. A single in-flight request is shared across callers. */
export function loadAssets(force = false): Promise<StudioAsset[]> {
  if (!force && cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/assets")
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((d) => {
        cache = (d.assets as StudioAsset[]) ?? [];
        return cache;
      })
      .catch(() => (cache = cache ?? []))
      .finally(() => {
        inflight = null;
        notify();
      });
  }
  return inflight;
}

/** Subscribe a component to the shared cache. Returns the current list + a revalidate fn. */
export function useAssets(): { assets: StudioAsset[]; loaded: boolean; refresh: () => void } {
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState(cache != null);

  useEffect(() => {
    const onChange = () => {
      setLoaded(true);
      force((n) => n + 1);
    };
    subscribers.add(onChange);
    loadAssets();
    return () => {
      subscribers.delete(onChange);
    };
  }, []);

  const refresh = useCallback(() => {
    void loadAssets(true);
  }, []);

  return { assets: cache ?? [], loaded, refresh };
}

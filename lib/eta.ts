import { sql } from "./db";
import { modelUnit } from "./pricing";

// Server-only.
if (typeof window !== "undefined") {
  throw new Error("lib/eta.ts was imported in a client bundle");
}

export interface ModelEta {
  /** Median wall-clock duration of recent completed jobs on this model. */
  medianMs: number;
  /** How many completed jobs the median is based on. */
  samples: number;
}

/** Cold-start guess before a model has any history, by output kind. */
export function fallbackDurationMs(model: string): number {
  return modelUnit(model) === "video_second" ? 90_000 : 22_000;
}

/**
 * Keep an ETA in a sane band. Guards against poisoned medians (a job created,
 * then completed hours later by a late poll or after a dev restart, makes the
 * raw wall-clock duration meaningless) and against absurdly small values.
 */
export function clampEtaMs(model: string, ms: number): number {
  const video = modelUnit(model) === "video_second";
  const min = video ? 15_000 : 6_000;
  const max = video ? 600_000 : 240_000; // 10 min video, 4 min image
  if (!Number.isFinite(ms) || ms <= 0) return fallbackDurationMs(model);
  return Math.min(Math.max(ms, min), max);
}

/**
 * Median completion time per model, from recent done jobs — the honest basis
 * for an ETA countdown (fal exposes no true progress percentage). Outliers are
 * tamed by the median; brand-new models fall back to a per-kind guess.
 */
export async function modelMedianDurations(): Promise<Map<string, ModelEta>> {
  const out = new Map<string, ModelEta>();
  try {
    const rows = await sql`
      SELECT model,
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))
             ) AS median_s,
             COUNT(*) AS n
      FROM (
        SELECT model, created_at, completed_at
        FROM jobs
        WHERE status = 'done' AND completed_at IS NOT NULL
          -- Drop poisoned samples: a real render is seconds-to-minutes, never
          -- hours. Jobs "completed" long after creation (late poll, dev restart)
          -- would otherwise blow up the median into a fake multi-hour ETA.
          AND completed_at > created_at
          AND completed_at - created_at < interval '20 minutes'
        ORDER BY created_at DESC
        LIMIT 400
      ) recent
      GROUP BY model
    `;
    for (const r of rows) {
      const medianS = Number(r.median_s);
      if (Number.isFinite(medianS) && medianS > 0) {
        out.set(r.model as string, { medianMs: Math.round(medianS * 1000), samples: Number(r.n) });
      }
    }
  } catch {
    // pre-migration / empty ledger — callers fall back per model
  }
  return out;
}

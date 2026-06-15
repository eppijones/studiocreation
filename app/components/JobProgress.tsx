"use client";

import { useEffect, useState } from "react";
import type { ClientJob } from "./studio";

/** Live ETA countdown, recomputed locally between polls for a smooth feel. */
function timeLeft(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 60) return `~${Math.floor(s / 60)}m ${s % 60}s left`;
  return `~${s}s left`;
}

/**
 * Honest progress bar for an in-flight job: the percentage is derived from the
 * model's median runtime (passed on the job as `medianMs`), so it counts up
 * toward done while the "time left" counts down. fal exposes no true percent,
 * so we cap just shy of 100% until the render actually lands.
 */
export function JobProgress({ job, compact = false }: { job: ClientJob; compact?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const created = new Date(job.created_at).getTime();
  const elapsed = Math.max(Date.now() - created, 0);
  const median = job.medianMs && job.medianMs > 0 ? job.medianMs : 22_000;
  const inQueue = job.status === "queued" && (job.queuePosition ?? 0) > 0;
  const raw = elapsed / median;
  const pct = Math.min(Math.max(raw, 0.04), 0.96);
  const leftMs = Math.max(median - elapsed, 0);
  const overdue = raw >= 1;

  const label = inQueue
    ? `Queued · #${job.queuePosition} in line`
    : overdue || leftMs < 800
      ? "wrapping up…"
      : timeLeft(leftMs);

  return (
    <div className={`jobprog ${overdue ? "over" : ""}`}>
      <div className="bar glow" style={{ ["--hue" as string]: undefined }}>
        <i style={{ width: `${pct * 100}%`, transition: "width 0.25s linear" }} />
      </div>
      {!compact && (
        <div className="jobprog-meta mono">
          <span className="jobprog-pct">{Math.round(pct * 100)}%</span>
          <span>{label}</span>
        </div>
      )}
    </div>
  );
}

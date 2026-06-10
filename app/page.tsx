"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimate } from "@/lib/pricing";

const MODEL = "fal-ai/flux/schnell";

interface JobAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
}

interface Job {
  id: number;
  model: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  est_usd: string;
  operator: string;
  project: string;
  label: string;
  error: string | null;
  created_at: string;
  assets: JobAsset[];
}

interface Budget {
  spentTodayUsd: number;
  capUsd: number;
  remainingUsd: number;
  warn: boolean;
}

function operatorFromCookie(): string {
  const match = document.cookie.match(/(?:^|; )studio_operator=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "unknown";
}

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [project, setProject] = useState("studio");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [operator, setOperator] = useState("unknown");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const est = useMemo(() => estimate({ provider: "fal", model: MODEL, count: 1 }), []);

  const refresh = useCallback(async () => {
    const [jobsRes, budgetRes] = await Promise.all([fetch("/api/jobs"), fetch("/api/budget")]);
    if (jobsRes.ok) setJobs((await jobsRes.json()).jobs);
    if (budgetRes.ok) setBudget(await budgetRes.json());
  }, []);

  useEffect(() => {
    setOperator(operatorFromCookie());
    refresh();
  }, [refresh]);

  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!hasActive) return;
    pollRef.current = setInterval(async () => {
      // Hitting each active job individually triggers the server-side polling fallback.
      const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
      await Promise.all(active.map((j) => fetch(`/api/jobs/${j.id}`)));
      refresh();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActive, jobs, refresh]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: MODEL, numImages: 1, project, label: label || "asset" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "daily_cap_exceeded") {
          throw new Error(`Daily cap reached ($${data.budget.capUsd}). Try again tomorrow.`);
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setPrompt("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  const capPct = budget ? Math.min((budget.spentTodayUsd / budget.capUsd) * 100, 100) : 0;

  return (
    <main>
      <h1>StudioCreation</h1>
      <p className="subtitle">
        Session 2 — queue, ledger, budget law. Operator: <strong>{operator}</strong>
      </p>

      {budget && (
        <div className={`banner${budget.warn ? " warn" : ""}`}>
          <span>
            {budget.warn ? "⚠️ " : "💰 "}Today: ${budget.spentTodayUsd.toFixed(2)} of $
            {budget.capUsd.toFixed(2)} shared daily cap
          </span>
          <span>${budget.remainingUsd.toFixed(2)} remaining</span>
          <div className="cap-bar">
            <div style={{ width: `${capPct}%` }} />
          </div>
        </div>
      )}

      <div className="panel">
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic still of..."
          disabled={busy}
        />
        <div className="row">
          <div style={{ flex: 1 }}>
            <label htmlFor="project">Project</label>
            <input id="project" value={project} onChange={(e) => setProject(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="label">Label</label>
            <input
              id="label"
              value={label}
              placeholder="asset"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <span className="model-tag">{MODEL}</span>
            <div className="estimate" style={{ marginTop: 8 }}>
              Preflight: <strong>${est.usd.toFixed(3)}</strong> — {est.breakdown}
            </div>
          </div>
          <button onClick={generate} disabled={busy || !prompt.trim()}>
            {busy ? "Queueing…" : "Generate"}
          </button>
        </div>
        {error && <p className="error">⚠️ {error}</p>}
      </div>

      <div className="jobs">
        <h2>Jobs</h2>
        {jobs.length === 0 && <p className="estimate">No jobs yet — generate something.</p>}
        {jobs.map((job) => {
          const asset = job.assets[0];
          const isVideo = asset?.content_type?.startsWith("video");
          return (
            <div className="job" key={job.id}>
              {asset ? (
                isVideo ? (
                  <video src={asset.blob_url} muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.blob_url} alt={job.label} />
                )
              ) : (
                <div style={{ width: 56, height: 56 }} />
              )}
              <div className="job-main">
                <div className="job-prompt">{job.prompt}</div>
                <div className="job-sub">
                  #{job.id} · {job.model.replace("fal-ai/", "")} · {job.project}/{job.label} ·{" "}
                  {job.operator} · ${Number(job.est_usd).toFixed(3)}
                  {job.error ? ` · ${job.error}` : ""}
                </div>
              </div>
              <span className={`chip ${job.status}`}>{job.status}</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}

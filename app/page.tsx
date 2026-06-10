"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimate, listModels, CONFIRM_THRESHOLD_USD } from "@/lib/pricing";
import brands from "@/config/brands.json";

const MODELS = listModels();
const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const BRAND_PROFILES = Object.entries(brands.profiles) as [
  string,
  { label: string; style: string },
][];

interface StudioPreset {
  kind: "image" | "video";
  model: string;
  ratio: string;
  seconds?: number;
  style: string;
}

interface Employee {
  id: string;
  name: string;
  description: string;
  studio: StudioPreset | null;
}

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
  const [model, setModel] = useState("fal-ai/flux/schnell");
  const [employeeId, setEmployeeId] = useState("");
  const [brandId, setBrandId] = useState("none");
  const [ratio, setRatio] = useState("1:1");
  const [numImages, setNumImages] = useState(1);
  const [seconds, setSeconds] = useState(5);
  const [audio, setAudio] = useState(false);
  const [fast, setFast] = useState(false);
  const [tier4k, setTier4k] = useState(false);
  const [project, setProject] = useState("studio");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [operator, setOperator] = useState("unknown");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modelInfo = MODELS.find((m) => m.id === model);
  const isVideo = modelInfo?.unit === "video_second";

  const est = useMemo(() => {
    try {
      return estimate({
        provider: "fal",
        model,
        count: isVideo ? seconds : numImages,
        tier: tier4k ? "4k" : undefined,
        audio,
        fast,
      });
    } catch {
      return null;
    }
  }, [model, isVideo, seconds, numImages, tier4k, audio, fast]);

  const employee = employees.find((e) => e.id === employeeId);
  const brand = BRAND_PROFILES.find(([id]) => id === brandId)?.[1];
  const styleSuffix = [employee?.studio?.style, brand?.style].filter(Boolean).join(", ");

  const refresh = useCallback(async () => {
    const [jobsRes, budgetRes] = await Promise.all([fetch("/api/jobs"), fetch("/api/budget")]);
    if (jobsRes.ok) setJobs((await jobsRes.json()).jobs);
    if (budgetRes.ok) setBudget(await budgetRes.json());
  }, []);

  useEffect(() => {
    setOperator(operatorFromCookie());
    refresh();
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees))
      .catch(() => {});
  }, [refresh]);

  function pickEmployee(id: string) {
    setEmployeeId(id);
    const preset = employees.find((e) => e.id === id)?.studio;
    if (preset) {
      setModel(preset.model);
      setRatio(preset.ratio);
      if (preset.seconds) setSeconds(preset.seconds);
    }
  }

  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!hasActive) return;
    pollRef.current = setInterval(async () => {
      const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
      await Promise.all(active.map((j) => fetch(`/api/jobs/${j.id}`)));
      refresh();
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActive, jobs, refresh]);

  async function generate(confirmed = false) {
    if (!est) return;
    if (est.usd > CONFIRM_THRESHOLD_USD && !confirmed) {
      const ok = window.confirm(
        `🎬 This job costs $${est.usd.toFixed(2)} (above the $${CONFIRM_THRESHOLD_USD} gate).\n${est.breakdown}\n\nSpend it?`
      );
      if (!ok) return;
      confirmed = true;
    }
    setBusy(true);
    setError(null);
    try {
      const fullPrompt = styleSuffix ? `${prompt.trim()}, ${styleSuffix}` : prompt.trim();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          model,
          numImages,
          seconds,
          ratio,
          audio,
          fast,
          tier: tier4k ? "4k" : undefined,
          project,
          label: label || (employee ? employee.id : "asset"),
          confirmed,
        }),
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
        Operator: <strong>{operator}</strong> · <a href="/gallery">gallery</a> ·{" "}
        <a href="/costs">costs</a>
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
        <div className="row" style={{ marginTop: 0 }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label htmlFor="employee">Employee</label>
            <select id="employee" value={employeeId} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">— none —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="brand">Brand profile</label>
            <select id="brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {BRAND_PROFILES.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic still of..."
            disabled={busy}
          />
          {styleSuffix && (
            <div className="estimate" style={{ marginTop: 6 }}>
              + style: {styleSuffix}
            </div>
          )}
        </div>

        <div className="row">
          <div style={{ flex: 2, minWidth: 220 }}>
            <label htmlFor="model">Model</label>
            <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id.replace("fal-ai/", "")} — ${m.usd}/{m.unit === "image" ? "img" : "s"}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label htmlFor="ratio">Ratio</label>
            <select id="ratio" value={ratio} onChange={(e) => setRatio(e.target.value)}>
              {RATIOS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          {isVideo ? (
            <div style={{ flex: 1, minWidth: 100 }}>
              <label htmlFor="seconds">Seconds</label>
              <input
                id="seconds"
                type="number"
                min={1}
                max={12}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 100 }}>
              <label htmlFor="numImages">Images</label>
              <input
                id="numImages"
                type="number"
                min={1}
                max={4}
                value={numImages}
                onChange={(e) => setNumImages(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {(modelInfo?.hasAudio || modelInfo?.hasFast || modelInfo?.has4k) && (
          <div className="row">
            {modelInfo.hasAudio && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "none" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={audio}
                  onChange={(e) => setAudio(e.target.checked)}
                />
                Audio on
              </label>
            )}
            {modelInfo.hasFast && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "none" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={fast}
                  onChange={(e) => setFast(e.target.checked)}
                />
                Fast mode
              </label>
            )}
            {modelInfo.has4k && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, textTransform: "none" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={tier4k}
                  onChange={(e) => setTier4k(e.target.checked)}
                />
                4K
              </label>
            )}
          </div>
        )}

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
          <div className="estimate">
            {est ? (
              <>
                Preflight: <strong>${est.usd.toFixed(3)}</strong> — {est.breakdown}
                {est.usd > CONFIRM_THRESHOLD_USD && " · 🎬 confirm required"}
              </>
            ) : (
              "No estimate"
            )}
          </div>
          <button onClick={() => generate()} disabled={busy || !prompt.trim() || !est}>
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
          const assetIsVideo = asset?.content_type?.startsWith("video");
          return (
            <div className="job" key={job.id}>
              {asset ? (
                assetIsVideo ? (
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

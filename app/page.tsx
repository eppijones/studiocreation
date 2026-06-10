"use client";

import { useMemo, useState } from "react";
import { estimate } from "@/lib/pricing";

const MODEL = "fal-ai/flux/schnell";

interface GenerationResult {
  requestId: string;
  images: { url: string; width?: number; height?: number }[];
  estimate: { usd: number; breakdown: string };
}

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const est = useMemo(
    () => estimate({ provider: "fal", model: MODEL, count: 1 }),
    []
  );

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: MODEL, numImages: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>StudioCreation</h1>
      <p className="subtitle">Session 1 — first light. One model, preflight always.</p>

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
          <div>
            <span className="model-tag">{MODEL}</span>
            <div className="estimate" style={{ marginTop: 8 }}>
              Preflight: <strong>${est.usd.toFixed(3)}</strong> — {est.breakdown}
            </div>
          </div>
          <button onClick={generate} disabled={busy || !prompt.trim()}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && <p className="error">⚠️ {error}</p>}
      </div>

      {result && result.images[0] && (
        <div className="result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.images[0].url} alt={prompt} />
          <div className="result-meta">
            <span>request {result.requestId}</span>
            <span>spent ${result.estimate.usd.toFixed(3)}</span>
          </div>
        </div>
      )}
    </main>
  );
}

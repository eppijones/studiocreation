"use client";

import { useEffect, useState } from "react";

interface Shot {
  label: string;
  model: string;
  prompt: string;
  ratio: string;
  count: number;
  kind: string;
  estUsd: number;
}

interface Brief {
  id: string;
  title: string;
  project: string;
  shots: Shot[];
  totalUsd: number;
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [selected, setSelected] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefs")
      .then((r) => r.json())
      .then((d) => {
        setBriefs(d.briefs);
        if (d.briefs.length > 0) setSelected(d.briefs[0]);
      })
      .catch(() => {});
  }, []);

  async function run() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/briefs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: selected.id, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "daily_cap_exceeded") {
          throw new Error(`Batch ($${data.totalUsd.toFixed(2)}) exceeds the remaining daily cap.`);
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const ok = data.queued.filter((q: { error?: string }) => !q.error).length;
      setResult(`🚀 ${ok}/${data.queued.length} shots queued — watch them on the generate page.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Briefs</h1>
      <p className="subtitle">
        Batch-brief runner — one spend card per batch · <a href="/">generate</a>
      </p>

      {briefs.length === 0 && (
        <p className="estimate">
          No briefs found. Add a markdown file to <code>briefs/</code> with a shot table (see
          briefs/studio-example.md) and redeploy.
        </p>
      )}

      {briefs.length > 0 && (
        <div className="panel">
          <label>Brief</label>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setSelected(briefs.find((b) => b.id === e.target.value) ?? null)}
          >
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.shots.length} shots)
              </option>
            ))}
          </select>

          {selected && (
            <>
              <div className="jobs" style={{ marginTop: 20 }}>
                {selected.shots.map((shot) => (
                  <div className="job" key={shot.label}>
                    <div className="job-main">
                      <div className="job-prompt">{shot.prompt}</div>
                      <div className="job-sub">
                        {shot.label} · {shot.model.replace("fal-ai/", "")} · {shot.ratio} ·{" "}
                        {shot.count} {shot.kind === "video" ? "s" : "img"}
                      </div>
                    </div>
                    <span className="chip">${shot.estUsd.toFixed(3)}</span>
                  </div>
                ))}
              </div>

              <div className="row">
                <div className="estimate">
                  🎬 Spend card: <strong>${selected.totalUsd.toFixed(2)}</strong> for{" "}
                  {selected.shots.length} shots — queuing is the go.
                </div>
                <button onClick={run} disabled={busy || selected.shots.length === 0}>
                  {busy ? "Queueing…" : `Queue batch ($${selected.totalUsd.toFixed(2)})`}
                </button>
              </div>
            </>
          )}
          {result && <p className="estimate" style={{ marginTop: 12 }}>{result}</p>}
          {error && <p className="error">⚠️ {error}</p>}
        </div>
      )}
    </main>
  );
}

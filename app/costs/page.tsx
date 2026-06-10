"use client";

import { useEffect, useState } from "react";
import { DAILY_CAP_USD } from "@/lib/pricing";

interface AggRow {
  usd: string;
  jobs: string;
  day?: string;
  project?: string;
  model?: string;
  operator?: string;
}

interface CostsData {
  byDay: AggRow[];
  byProject: AggRow[];
  byModel: AggRow[];
  byOperator: AggRow[];
  totals: {
    total_usd: string | null;
    reconciled_usd: string | null;
    reconciled_jobs: string;
    jobs: string;
    month_usd: string | null;
  };
}

interface ReconcileResult {
  matched: number;
  driftFlags: { jobId: number; estUsd: number; actualUsd: number }[];
  message?: string;
  error?: string;
}

function Section({ title, rows, keyField }: { title: string; rows: AggRow[]; keyField: keyof AggRow }) {
  const max = Math.max(...rows.map((r) => Number(r.usd)), 0.0001);
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h2 className="costs-h2">{title}</h2>
      {rows.length === 0 && <p className="estimate">No spend yet.</p>}
      {rows.map((row) => (
        <div className="costs-row" key={String(row[keyField])}>
          <span className="costs-key">{String(row[keyField]).replace("fal-ai/", "")}</span>
          <div className="costs-bar">
            <div style={{ width: `${(Number(row.usd) / max) * 100}%` }} />
          </div>
          <span className="costs-val">
            ${Number(row.usd).toFixed(2)} · {row.jobs} jobs
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  async function load() {
    const res = await fetch("/api/costs");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function reconcile() {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await fetch("/api/reconcile", { method: "POST" });
      setReconcileResult(await res.json());
      await load();
    } finally {
      setReconciling(false);
    }
  }

  if (!data) {
    return (
      <main>
        <h1>Costs</h1>
        <p className="estimate">Loading…</p>
      </main>
    );
  }

  const total = Number(data.totals.total_usd ?? 0);
  const month = Number(data.totals.month_usd ?? 0);

  return (
    <main>
      <h1>Costs</h1>
      <p className="subtitle">
        <a href="/">generate</a> · <a href="/gallery">gallery</a>
      </p>

      <div className="banner">
        <span>
          💰 All-time: <strong>${total.toFixed(2)}</strong> · This month: ${month.toFixed(2)}
        </span>
        <span>
          {data.totals.reconciled_jobs}/{data.totals.jobs} jobs reconciled · daily cap $
          {DAILY_CAP_USD.toFixed(2)}
        </span>
      </div>

      <div className="row" style={{ marginBottom: 16, marginTop: 0 }}>
        <span className="estimate">
          Reconciler matches ledger rows to fal billing events and records actual spend.
        </span>
        <button onClick={reconcile} disabled={reconciling}>
          {reconciling ? "Reconciling…" : "Reconcile vs fal"}
        </button>
      </div>
      {reconcileResult && (
        <div className={`banner${reconcileResult.driftFlags?.length ? " warn" : ""}`}>
          <span>
            {reconcileResult.error
              ? `⚠️ ${reconcileResult.error}`
              : `✅ ${reconcileResult.matched} matched${
                  reconcileResult.driftFlags?.length
                    ? ` · ⚠️ ${reconcileResult.driftFlags.length} drift >10% — check pricing.json`
                    : " · no drift"
                }`}
            {reconcileResult.message ? ` — ${reconcileResult.message}` : ""}
          </span>
        </div>
      )}

      <Section title="By day (30d)" rows={data.byDay} keyField="day" />
      <Section title="By project" rows={data.byProject} keyField="project" />
      <Section title="By model" rows={data.byModel} keyField="model" />
      <Section title="By operator" rows={data.byOperator} keyField="operator" />
    </main>
  );
}

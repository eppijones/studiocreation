"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "../components/AppShell";
import { Card, Btn, FuelGauge, Seg, ProviderBadge, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { modelShort, money, usd } from "../components/studio";

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

interface AccuracyData {
  byModel: Record<string, { reconciledJobs: number; meanDriftPct: number; maxDriftPct: number }>;
}

type Range = "today" | "week" | "month";
const RANGE_LABEL: Record<Range, string> = { today: "Today", week: "Week", month: "Month" };

/** fal.ai is the single generation adapter — every model endpoint is fal. */
function providerOf(_model: string): "fal" {
  return "fal";
}

/** Horizontal bar row: label + bar (inline width %) + mono cost. */
function BarRow({ label, usd: spend, jobs, max }: { label: string; usd: number; jobs: number; max: number }) {
  return (
    <div className="row gap3" style={{ alignItems: "center" }}>
      <span
        className="t-sm"
        style={{ width: 130, flex: "none", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {label}
      </span>
      <div className="bar grow" style={{ height: 8 }}>
        <i style={{ width: `${(spend / max) * 100}%` }} />
      </div>
      <span className="mono t-sm" style={{ flex: "none", textAlign: "right", minWidth: 96 }}>
        {money(spend)} <span className="muted">· {jobs}</span>
      </span>
    </div>
  );
}

export default function CostsPage() {
  const { budget } = useStudio();
  const toast = useToast();

  const [data, setData] = useState<CostsData | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [range, setRange] = useState<Range>("week");

  const load = useCallback(async () => {
    const [costsRes, accRes] = await Promise.all([fetch("/api/costs"), fetch("/api/accuracy")]);
    if (costsRes.ok) setData(await costsRes.json());
    if (accRes.ok) setAccuracy(await accRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function reconcile() {
    setReconciling(true);
    setReconcileResult(null);
    try {
      // /api/reconcile always responds 200, even on a fal key error (error is in body).
      const res = await fetch("/api/reconcile", { method: "POST" });
      const result: ReconcileResult = await res.json();
      setReconcileResult(result);
      if (result.error) {
        toast({ kind: "bad", title: "Reconcile failed", sub: result.error });
      } else if (result.driftFlags?.length) {
        toast({
          kind: "info",
          title: `${result.matched} matched · ${result.driftFlags.length} drift`,
          sub: "Drift >10% — check pricing.json",
        });
      } else {
        toast({ kind: "ok", title: `${result.matched} matched`, sub: "No drift against fal billing" });
      }
      await load();
    } catch {
      toast({ kind: "bad", title: "Reconcile failed", sub: "Could not reach the reconciler." });
    } finally {
      setReconciling(false);
    }
  }

  /** byDay rows scoped to the selected range (today / last 7d / current month). */
  const dayRows = useMemo(() => {
    if (!data) return [] as AggRow[];
    const rows = data.byDay.filter((r) => r.day);
    if (range === "today") {
      const today = new Date().toISOString().slice(0, 10);
      return rows.filter((r) => (r.day ?? "").slice(0, 10) === today);
    }
    if (range === "week") {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - 6);
      const since = cutoff.toISOString().slice(0, 10);
      return rows.filter((r) => (r.day ?? "").slice(0, 10) >= since);
    }
    const month = new Date().toISOString().slice(0, 7);
    return rows.filter((r) => (r.day ?? "").slice(0, 7) === month);
  }, [data, range]);

  const rangeUsd = dayRows.reduce((s, r) => s + Number(r.usd), 0);
  const rangeJobs = dayRows.reduce((s, r) => s + Number(r.jobs), 0);

  if (!data) {
    return (
      <div className="screen-pad">
        <div className="screen-hd">
          <div className="titles">
            <p className="t-label t-eyebrow">Costs · Ledger</p>
            <h1 className="t-h1">Reading the ledger…</h1>
          </div>
        </div>
        <Card pad>
          <p className="t-sm muted">Pulling spend aggregations.</p>
        </Card>
      </div>
    );
  }

  const spentWeek = budget?.spentWeekUsd ?? 0;
  const weeklyCap = budget?.settings.weeklyCapUsd ?? 50;
  const remainingWeek = budget?.remainingWeekUsd ?? Math.max(weeklyCap - spentWeek, 0);
  const monthlyPool = budget?.settings.monthlyPoolUsd ?? 120;
  const spentMonth = budget?.spentMonthUsd ?? Number(data.totals.month_usd ?? 0);

  const reconciledJobs = Number(data.totals.reconciled_jobs ?? 0);
  const totalJobs = Number(data.totals.jobs ?? 0);

  // Headline spend: spend within the selected range; "Week" leans on the live budget figure.
  const headlineUsd = range === "week" ? spentWeek : rangeUsd;
  const statusLine =
    range === "week"
      ? `${usd(remainingWeek)} of ${usd(weeklyCap)} left · ${rangeJobs || totalJobs} job${(rangeJobs || totalJobs) === 1 ? "" : "s"}`
      : `${usd(rangeUsd)} across ${RANGE_LABEL[range].toLowerCase()} · ${rangeJobs} job${rangeJobs === 1 ? "" : "s"}`;

  // model breakdown
  const models = data.byModel.map((r) => ({ model: r.model ?? "", usd: Number(r.usd), jobs: Number(r.jobs) }));
  const maxModel = Math.max(...models.map((m) => m.usd), 0.0001);

  // provider breakdown derived from model ids
  const provMap = new Map<string, { usd: number; jobs: number }>();
  for (const m of models) {
    const p = providerOf(m.model);
    const cur = provMap.get(p) ?? { usd: 0, jobs: 0 };
    provMap.set(p, { usd: cur.usd + m.usd, jobs: cur.jobs + m.jobs });
  }
  const providers = Array.from(provMap.entries()).sort((a, b) => b[1].usd - a[1].usd);
  const maxProv = Math.max(...providers.map(([, v]) => v.usd), 0.0001);

  const projects = data.byProject.map((r) => ({ project: r.project ?? "", usd: Number(r.usd), jobs: Number(r.jobs) }));
  const maxProject = Math.max(...projects.map((p) => p.usd), 0.0001);

  const operators = data.byOperator.map((r) => ({ operator: r.operator ?? "", usd: Number(r.usd), jobs: Number(r.jobs) }));

  // ledger rows: latest spend by day → flatten to per-day entries, richest available detail per day
  const ledger = data.byDay
    .filter((r) => r.day)
    .slice(0, 30)
    .map((r) => ({ day: r.day!, usd: Number(r.usd), jobs: Number(r.jobs) }));

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Costs · Ledger</p>
          <h1 className="t-h1">{money(headlineUsd)} spent {range === "today" ? "today" : `this ${range}`}</h1>
          <p className="t-body">{statusLine}</p>
        </div>
        <div className="actions row gap3">
          <Seg
            options={(["today", "week", "month"] as Range[]).map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
            value={range}
            onChange={setRange}
          />
          <Btn variant="ghost" icon="refresh" disabled={reconciling} onClick={reconcile}>
            {reconciling ? "Reconciling…" : "Reconcile"}
          </Btn>
        </div>
      </div>

      {reconcileResult && (
        <Card pad style={{ marginBottom: 16 }}>
          <div className="row gap2" style={{ alignItems: "center" }}>
            <Icon
              name={reconcileResult.error ? "alert" : reconcileResult.driftFlags?.length ? "alert" : "checkcircle"}
              size={16}
            />
            <span
              className="t-sm"
              style={{
                color: reconcileResult.error
                  ? "var(--bad-tx)"
                  : reconcileResult.driftFlags?.length
                    ? "var(--warn-tx)"
                    : "var(--ok-tx)",
                fontWeight: 600,
              }}
            >
              {reconcileResult.error
                ? `Reconcile error: ${reconcileResult.error}`
                : `${reconcileResult.matched} matched against fal billing${
                    reconcileResult.driftFlags?.length
                      ? ` · ${reconcileResult.driftFlags.length} drift >10% — check pricing.json`
                      : " · no drift"
                  }`}
              {reconcileResult.message ? ` — ${reconcileResult.message}` : ""}
            </span>
          </div>
          {!reconcileResult.error && reconcileResult.driftFlags?.length > 0 && (
            <div className="meta-rows mono t-xs" style={{ marginTop: 10 }}>
              {reconcileResult.driftFlags.slice(0, 6).map((d) => (
                <div className="meta-row" key={d.jobId}>
                  <span className="k">Job #{d.jobId}</span>
                  <span>
                    est {usd(d.estUsd, 4)} → actual {usd(d.actualUsd, 4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="split">
        {/* LEFT */}
        <div className="col gap4">
          {/* weekly budget summary */}
          <Card pad>
            <span className="t-label">This week&apos;s budget</span>
            <div className="row between" style={{ margin: "12px 0 10px", alignItems: "flex-end" }}>
              <span className="t-h2 mono">{usd(spentWeek)}</span>
              <span className="t-sm muted">{usd(remainingWeek)} of {usd(weeklyCap)} left</span>
            </div>
            <FuelGauge spent={spentWeek} cap={weeklyCap} />
            {(budget?.jobsWeek ?? 0) > 0 && (
              <div className="row between" style={{ marginTop: 10, alignItems: "baseline" }}>
                <span className="t-sm" style={{ fontWeight: 600 }}>
                  📈 ≈ {usd(budget?.projectedWeekUsd ?? spentWeek)}/week at this pace
                </span>
                <span className="t-xs muted mono">
                  {budget?.jobsWeek} job{budget?.jobsWeek === 1 ? "" : "s"} · {usd(budget?.avgJobUsd ?? 0, 3)}/job
                </span>
              </div>
            )}
            <div className="hr" style={{ margin: "14px 0" }} />
            <div className="meta-rows mono t-xs">
              <div className="meta-row">
                <span className="k">Team pool this month</span>
                <span>
                  {usd(spentMonth)} / {usd(monthlyPool, 0)}
                </span>
              </div>
              <div className="meta-row">
                <span className="k">Reconciled vs fal</span>
                <span>
                  {reconciledJobs}/{totalJobs} jobs
                </span>
              </div>
              <div className="meta-row">
                <span className="k">All-time logged</span>
                <span>{usd(Number(data.totals.total_usd ?? 0))}</span>
              </div>
            </div>
            {budget?.suggestEconomize && (
              <p className="t-xs" style={{ color: "var(--warn-tx)", marginTop: 12 }}>
                ⚠️ Budget running hot — explore at low quality / Fast lane, commit the keeper render once.
              </p>
            )}
          </Card>

          {/* spend by model */}
          <Card pad>
            <span className="t-label">Spend by model — actuals where reconciled, estimates otherwise</span>
            <div className="col gap3" style={{ marginTop: 14 }}>
              {models.length === 0 ? (
                <p className="t-sm muted">No spend yet. Send something from Create.</p>
              ) : (
                models.map((m) => (
                  <BarRow key={m.model} label={modelShort(m.model)} usd={m.usd} jobs={m.jobs} max={maxModel} />
                ))
              )}
            </div>
          </Card>

          {/* ledger */}
          <Card>
            <div className="card-hd">
              <span className="t-h3">Ledger · last 30 days</span>
              <span className="t-xs muted">{ledger.length} days logged</span>
            </div>
            <div className="card-pad">
              {ledger.length === 0 ? (
                <div className="empty" style={{ padding: "32px 0" }}>
                  <Icon name="costs" size={32} />
                  <span>No spend on the books yet.</span>
                </div>
              ) : (
                <div className="col gap1">
                  <div
                    className="t-xs muted mono"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 12,
                      padding: "0 14px 8px",
                    }}
                  >
                    <span>Day</span>
                    <span style={{ textAlign: "right" }}>Jobs</span>
                    <span style={{ textAlign: "right" }}>Cost</span>
                  </div>
                  {ledger.map((row) => (
                    <div
                      key={row.day}
                      className="linerow"
                      style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "10px 14px" }}
                    >
                      <div className="row gap2" style={{ alignItems: "center", minWidth: 0 }}>
                        <Icon name="clock" size={14} />
                        <span className="t-sm mono" style={{ fontWeight: 600 }}>
                          {row.day.slice(0, 10)}
                        </span>
                        <ProviderBadge provider="fal" />
                      </div>
                      <span className="mono t-sm muted" style={{ textAlign: "right", alignSelf: "center" }}>
                        {row.jobs} job{row.jobs === 1 ? "" : "s"}
                      </span>
                      <span className="mono t-sm" style={{ textAlign: "right", alignSelf: "center", fontWeight: 600 }}>
                        {money(row.usd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="col gap4">
          {/* by provider */}
          <Card pad>
            <span className="t-label">By provider</span>
            <div className="col gap3" style={{ marginTop: 14 }}>
              {providers.length === 0 ? (
                <p className="t-sm muted">No spend yet.</p>
              ) : (
                providers.map(([prov, v]) => (
                  <div key={prov} className="col gap1">
                    <div className="row between" style={{ alignItems: "center" }}>
                      <ProviderBadge provider={prov} />
                      <span className="mono t-sm">
                        {money(v.usd)} <span className="muted">· {v.jobs}</span>
                      </span>
                    </div>
                    <div className="bar" style={{ height: 8 }}>
                      <i style={{ width: `${(v.usd / maxProv) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* estimate accuracy — how close preflight lands to the fal bill */}
          <Card pad>
            <span className="t-label">Estimate accuracy — preflight vs fal bill</span>
            <div className="col gap2" style={{ marginTop: 14 }}>
              {!accuracy || Object.keys(accuracy.byModel).length === 0 ? (
                <p className="t-sm muted">
                  No reconciled jobs yet. Hit <strong>Reconcile</strong> to verify estimates against
                  fal billing — drift shows up here per model.
                </p>
              ) : (
                Object.entries(accuracy.byModel)
                  .sort((a, b) => b[1].meanDriftPct - a[1].meanDriftPct)
                  .map(([model, a]) => {
                    const tone = a.meanDriftPct <= 5 ? "ok" : a.meanDriftPct <= 10 ? "warn" : "bad";
                    return (
                      <div key={model} className="row between" style={{ alignItems: "center" }}>
                        <div className="col" style={{ minWidth: 0 }}>
                          <span className="t-sm" style={{ fontWeight: 600 }}>{modelShort(model)}</span>
                          <span className="t-xs muted mono">
                            {a.reconciledJobs} job{a.reconciledJobs === 1 ? "" : "s"} · max {a.maxDriftPct}%
                          </span>
                        </div>
                        <span
                          className="mono t-sm"
                          style={{ flex: "none", fontWeight: 700, color: `var(--${tone}-tx)` }}
                        >
                          {a.meanDriftPct === 0 ? "exact" : `±${a.meanDriftPct}%`}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          </Card>

          {/* by project */}
          <Card pad>
            <span className="t-label">By project</span>
            <div className="col gap3" style={{ marginTop: 14 }}>
              {projects.length === 0 ? (
                <p className="t-sm muted">No spend yet.</p>
              ) : (
                projects.map((p) => (
                  <BarRow key={p.project} label={p.project} usd={p.usd} jobs={p.jobs} max={maxProject} />
                ))
              )}
            </div>
          </Card>

          {/* by operator */}
          <Card pad>
            <span className="t-label">By operator</span>
            <div className="col gap2" style={{ marginTop: 12 }}>
              {operators.length === 0 ? (
                <p className="t-sm muted">No spend yet.</p>
              ) : (
                operators.map((o) => (
                  <div key={o.operator} className="row between mono t-sm">
                    <span style={{ fontWeight: 600 }}>{o.operator}</span>
                    <span>
                      {money(o.usd)} <span className="muted">· {o.jobs}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

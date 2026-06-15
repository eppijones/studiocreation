"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Pill, Cost, useToast } from "../components/ui";
import { Media } from "../components/Media";
import { Icon } from "../components/Icon";
import { glowVars, hueFor, modelShort, money, usd } from "../components/studio";

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

/* job + asset rows we match back to brief shots by project/label */
interface JobRow {
  id: number;
  model: string;
  status: "queued" | "running" | "done" | "error";
  est_usd: string;
  project: string;
  label: string;
  assets: { id: number; blob_url: string; content_type: string | null }[];
}
interface AssetRow {
  id: number;
  blob_url: string;
  content_type: string | null;
  score: number | null;
  status: string;
  project: string;
  label: string;
}

/* one shot enriched with its live job state, matched on project+label */
interface ShotRow extends Shot {
  done: boolean;
  status: "queued" | "running" | "done" | "error" | "new";
  score: number | null;
  spentUsd: number;
  thumb?: string | null;
  thumbKind?: string | null;
  hueKey: number;
}

interface BriefRow {
  brief: Brief;
  shots: ShotRow[];
  done: number;
  total: number;
  spentUsd: number;
  okPct: number;
}

const EMPLOYEE_FOR = (label: string) => label.split(/[-_]/)[0] || "studio";

export default function BriefsPage() {
  const { budget, refresh } = useStudio();
  const toast = useToast();

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, j, a] = await Promise.all([
      fetch("/api/briefs"),
      fetch("/api/jobs"),
      fetch("/api/assets"),
    ]);
    if (b.ok) {
      const list = ((await b.json()).briefs ?? []) as Brief[];
      setBriefs(list);
      setSelectedId((cur) => cur ?? (list.length ? list[0].id : null));
    }
    if (j.ok) setJobs(((await j.json()).jobs ?? []) as JobRow[]);
    if (a.ok) setAssets(((await a.json()).assets ?? []) as AssetRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* enrich every brief with live progress matched on project + label */
  const rows = useMemo<BriefRow[]>(() => {
    return briefs.map((brief) => {
      const shots: ShotRow[] = brief.shots.map((shot) => {
        const job = jobs.find((x) => x.project === brief.project && x.label === shot.label);
        const asset = assets.find((x) => x.project === brief.project && x.label === shot.label);
        const status = job?.status ?? "new";
        const spentUsd = job ? Number(job.est_usd) : 0;
        const thumb = asset?.blob_url ?? job?.assets[0]?.blob_url ?? null;
        const thumbKind = asset?.content_type ?? job?.assets[0]?.content_type ?? null;
        return {
          ...shot,
          done: status === "done",
          status,
          score: asset?.score ?? null,
          spentUsd,
          thumb,
          thumbKind,
          hueKey: hueFor(job?.id ?? shot.label),
        };
      });
      const done = shots.filter((s) => s.done).length;
      const spentUsd = shots.reduce((a, s) => a + s.spentUsd, 0);
      return {
        brief,
        shots,
        done,
        total: shots.length,
        spentUsd,
        okPct: shots.length ? Math.round((done / shots.length) * 100) : 0,
      };
    });
  }, [briefs, jobs, assets]);

  const selected = rows.find((r) => r.brief.id === selectedId) ?? null;

  /* remaining = shots not yet queued/done; estimate is their cost */
  const remainingShots = selected ? selected.shots.filter((s) => s.status === "new") : [];
  const remainingEst = remainingShots.reduce((a, s) => a + s.estUsd, 0);
  const remainingWeekUsd = budget?.remainingWeekUsd ?? 0;
  // the route re-queues the whole brief, so gate against the full batch charge, not just the remaining estimate
  const batchCharge = selected?.brief.totalUsd ?? 0;
  const overCap = batchCharge > remainingWeekUsd;

  async function run() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/briefs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: selected.brief.id, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        // route returns cap_exceeded; current page also checked weekly_cap_exceeded — handle both
        if (data.error === "cap_exceeded" || data.error === "weekly_cap_exceeded") {
          throw new Error(
            `Batch (${money(Number(data.totalUsd ?? 0))}) exceeds the remaining budget. Raise the cap in Settings or wait for next week.`
          );
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const ok = (data.queued as { error?: string }[]).filter((q) => !q.error).length;
      toast({
        kind: "ok",
        title: "Batch queued",
        sub: `${ok}/${data.queued.length} shots on the line · ${money(Number(data.totalUsd ?? 0))}`,
      });
      refresh();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Briefs · Batch runner</p>
          <h1 className="t-h1">Campaign batches</h1>
          <p className="t-body">one brief, many jobs, one preflight</p>
        </div>
      </div>

      {briefs.length === 0 ? (
        <Card>
          <div className="empty" style={{ padding: "56px 24px" }}>
            <Icon name="briefs" size={32} />
            <span>
              No briefs yet. Drop a markdown file in <code className="mono">briefs/</code> with a shot
              table — label · model · prompt · ratio · count — and it appears here.
            </span>
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
          {/* LEFT — brief list */}
          <div className="col gap2">
            {rows.map((r) => {
              const on = r.brief.id === selectedId;
              return (
                <Card
                  key={r.brief.id}
                  pad
                  sel={on}
                  onClick={() => setSelectedId(r.brief.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="row gap2" style={{ alignItems: "center" }}>
                    <span className="dot" style={{ background: `oklch(0.7 0.16 ${hueFor(r.brief.project)})` }} />
                    <span className="t-sm" style={{ fontWeight: 700, color: "var(--tx-1)" }}>
                      {r.brief.project}
                    </span>
                    <span className="grow" />
                    <span className="t-xs mono muted">
                      {r.done}/{r.total}
                    </span>
                  </div>
                  <div className="t-sm" style={{ marginTop: 6, color: "var(--tx-2)" }}>
                    {r.brief.title}
                  </div>
                  <div className={`bar ${r.okPct >= 100 ? "ok" : ""}`} style={{ marginTop: 10 }}>
                    <i style={{ width: `${r.okPct}%` }} />
                  </div>
                  <div className="row between t-xs mono" style={{ marginTop: 8 }}>
                    <span className="muted">{usd(r.spentUsd)} spent</span>
                    <span style={{ color: "var(--tx-2)" }}>est {money(r.brief.totalUsd)}</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* RIGHT — selected brief shot list */}
          {selected && (
            <Card>
              <div className="card-hd">
                <div className="row gap2" style={{ alignItems: "baseline" }}>
                  <span className="t-h3">{selected.brief.title}</span>
                  <span className="t-xs mono muted">{selected.okPct}%</span>
                </div>
                <div className="bar" style={{ width: 120 }}>
                  <i style={{ width: `${selected.okPct}%` }} />
                </div>
              </div>

              <div className="card-pad col gap2">
                {selected.shots.map((shot) => (
                  <div
                    className="linerow"
                    key={shot.label}
                    style={glowVars(shot.hueKey)}
                  >
                    <Media
                      src={shot.thumb}
                      kind={shot.thumbKind}
                      hueKey={shot.hueKey}
                      aspect="3 / 2"
                      style={{ width: 64, flex: "none" }}
                    />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div
                        className="t-sm"
                        style={{ color: "var(--tx-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {shot.label}
                      </div>
                      <div className="t-xs mono" style={{ marginTop: 2, color: "var(--tx-3)" }}>
                        {EMPLOYEE_FOR(shot.label)} · {modelShort(shot.model)} · {shot.ratio} ·{" "}
                        {shot.count}
                        {shot.kind === "video" ? "s" : "img"}
                      </div>
                    </div>
                    <span className="t-xs mono" style={{ color: shot.score != null && shot.score >= 8 ? "var(--ok-tx)" : "var(--tx-3)" }}>
                      {shot.score != null ? `${shot.score}/10` : "—"}
                    </span>
                    <Pill state={shot.status} />
                    <Cost usd={shot.estUsd} />
                  </div>
                ))}
              </div>

              <div className="card-pad row between" style={{ borderTop: "1px solid var(--line-1)" }}>
                <div className="col" style={{ gap: 2 }}>
                  <span className="t-sm" style={{ fontWeight: 600 }}>
                    {remainingShots.length === 0
                      ? "All shots queued"
                      : `${remainingShots.length} shot${remainingShots.length > 1 ? "s" : ""} remaining`}
                  </span>
                  <span className="t-xs mono muted">
                    est {money(remainingEst)} · {usd(remainingWeekUsd)} left this week
                  </span>
                </div>
                <Btn
                  variant="primary"
                  size="lg"
                  icon="play"
                  disabled={busy || remainingShots.length === 0 || overCap}
                  onClick={run}
                >
                  {busy
                    ? "Queueing…"
                    : remainingShots.length === 0
                      ? "Nothing to run"
                      : `Run remaining · ${money(remainingEst)}`}
                </Btn>
              </div>

              {overCap && remainingShots.length > 0 && (
                <p className="err" style={{ margin: "0 16px 16px" }}>
                  ⚠️ Running this brief ({money(batchCharge)}) exceeds today&apos;s remaining budget.
                </p>
              )}
              {error && (
                <p className="err" style={{ margin: "0 16px 16px" }}>
                  ⚠️ {error}
                </p>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

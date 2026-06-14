"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStudio } from "../components/AppShell";
import { Card, Btn, Pill, Cost, StatCard, FuelGauge, CountUp, Sparkline } from "../components/ui";
import { Media, Tile } from "../components/Media";
import { Spotlight } from "../components/Spotlight";
import { Icon } from "../components/Icon";
import { glowVars, modelShort, usd, relTime } from "../components/studio";

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
  created_at: string;
  assets: JobAsset[];
}
interface Asset {
  id: number;
  job_id: number;
  blob_url: string;
  content_type: string | null;
  score: number | null;
  status: string;
  created_at: string;
  label?: string;
  project?: string;
  duration_s?: number | null;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function DashboardPage() {
  const { operator, budget } = useStudio();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [spendSeries, setSpendSeries] = useState<number[]>([]);

  const load = useCallback(async () => {
    const [j, a, c] = await Promise.all([fetch("/api/jobs"), fetch("/api/assets"), fetch("/api/costs")]);
    if (j.ok) setJobs((await j.json()).jobs);
    if (a.ok) setAssets((await a.json()).assets);
    if (c.ok) {
      const costs = await c.json();
      const byDay = (costs.byDay ?? []) as Record<string, unknown>[];
      const series = byDay
        .map((d) => Number(d.cost ?? d.usd ?? d.total ?? d.value ?? 0))
        .filter((n) => Number.isFinite(n));
      // chronological, last ~12 points
      setSpendSeries(series.slice(-12));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const running = live.filter((j) => j.status === "running");
  const queued = live.filter((j) => j.status === "queued");
  const today = new Date().toISOString().slice(0, 10);
  const madeToday = jobs.filter((j) => j.status === "done" && j.created_at.slice(0, 10) === today).length;
  const unscored = assets.filter((a) => a.score == null && a.status !== "hidden");
  const heroEligible = assets.filter((a) => (a.score ?? 0) >= 8).length;
  const latest = assets.filter((a) => a.status !== "hidden").slice(0, 8);

  // Spotlight: the studio's best work up front. Approved + high-scoring renders
  // lead; if there aren't enough standouts yet, fall back to the latest so the
  // rail is never empty.
  const visible = assets.filter((a) => a.status !== "hidden" && a.blob_url);
  const heroes = visible.filter((a) => a.status === "approved" || a.status === "delivered" || (a.score ?? 0) >= 8);
  const spotlight = (heroes.length >= 3 ? heroes : visible)
    .slice(0, 12)
    .map((a) => ({
      id: a.id,
      blob_url: a.blob_url,
      content_type: a.content_type,
      score: a.score,
      label: a.label,
      project: a.project,
      created_at: a.created_at,
      duration_s: a.duration_s,
      hueKey: a.job_id,
    }));
  const spotlightSub =
    heroes.length >= 3 ? "Your highest-scoring & kept renders" : "Your latest renders";

  const remaining = budget?.remainingWeekUsd ?? 0;
  const statusLine = `${running.length} generating · ${unscored.length} to review · ${usd(remaining)} of this week's budget left`;

  return (
    <div className="screen-pad">
      <div className="screen-hd">
        <div className="titles">
          <p className="t-label t-eyebrow">Overview · {DATE_FMT.format(new Date())}</p>
          <h1 className="t-display">
            {greeting()}, {operator}.
          </h1>
          <p className="t-body">{statusLine}</p>
        </div>
        <div className="actions">
          <Link href="/create">
            <Btn variant="primary" size="lg" icon="create">
              New generation
            </Btn>
          </Link>
        </div>
      </div>

      {spotlight.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Spotlight items={spotlight} title="Spotlight" subtitle={spotlightSub} />
        </div>
      )}

      {/* KPI row */}
      <div className="kpi-row" style={{ marginBottom: 18 }}>
        <StatCard
          label="Generating now"
          value={<CountUp value={running.length} decimals={0} />}
          tone={running.length ? "accent" : undefined}
          desc={queued.length ? `${queued.length} queued behind` : "queue is clear"}
        >
          <div className={`bar ${running.length ? "run" : ""}`} style={{ marginTop: 4 }}>
            <i style={{ width: running.length ? "62%" : "0%" }} />
          </div>
        </StatCard>
        <StatCard
          label="Made today"
          value={<CountUp value={madeToday} decimals={0} />}
          unit="renders"
          desc={`${heroEligible} hero-eligible`}
          tone="ok"
        />
        <StatCard
          label="Spent this week"
          value={<CountUp value={budget?.spentWeekUsd ?? 0} prefix="$" />}
          tone="accent"
          desc={`of ${usd(budget?.settings.weeklyCapUsd ?? 50)} shared cap`}
        >
          {budget && <FuelGauge spent={budget.spentWeekUsd} cap={budget.settings.weeklyCapUsd} />}
        </StatCard>
        <StatCard
          label="Needs scoring"
          value={<CountUp value={unscored.length} decimals={0} />}
          tone={unscored.length ? "accent" : "ok"}
          desc={unscored.length ? "open review →" : "all caught up"}
        />
      </div>

      <div className="split">
        {/* LEFT */}
        <div className="col gap4">
          <Card>
            <div className="card-hd">
              <span className="t-h3">On the line</span>
              <Link href="/queue" className="t-xs" style={{ color: "var(--accent-hi)" }}>
                Generations →
              </Link>
            </div>
            <div className="card-pad col gap2">
              {live.length === 0 && (
                <div className="empty" style={{ padding: "28px 0" }}>
                  <Icon name="checkcircle" size={32} />
                  <span>Line is idle. Send something from Create.</span>
                </div>
              )}
              {live.map((j) => (
                <div className="linerow" key={j.id} style={glowVars(j.operator)}>
                  <Media
                    src={j.assets[0]?.blob_url}
                    kind={j.assets[0]?.content_type}
                    hueKey={j.operator}
                    aspect="3 / 2"
                    style={{ width: 72, flex: "none" }}
                  />
                  <div className="grow">
                    <div className="t-sm" style={{ color: "var(--tx-1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {j.prompt}
                    </div>
                    <div className="t-xs mono" style={{ marginTop: 2 }}>
                      {modelShort(j.model)} · {j.project}/{j.label}
                    </div>
                    {j.status === "running" && (
                      <div className="bar glow" style={{ marginTop: 8 }}>
                        <i style={{ width: "100%" }} />
                      </div>
                    )}
                  </div>
                  <div className="col gap1" style={{ alignItems: "flex-end" }}>
                    <Cost usd={Number(j.est_usd)} />
                    <Pill state={j.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card-hd">
              <span className="t-h3">Latest renders</span>
              <Link href="/gallery" className="t-xs" style={{ color: "var(--accent-hi)" }}>
                Gallery →
              </Link>
            </div>
            <div className="card-pad">
              {latest.length === 0 ? (
                <p className="t-sm muted">Nothing yet — your first render lands here.</p>
              ) : (
                <div className="grid-4">
                  {latest.map((a) => (
                    <Link key={a.id} href="/gallery">
                      <Tile
                        asset={{
                          id: a.id,
                          blob_url: a.blob_url,
                          content_type: a.content_type,
                          score: a.score,
                          hueKey: a.job_id,
                        }}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="col gap4">
          <Card pad>
            <div className="between">
              <span className="t-label">This week&apos;s spend</span>
              {spendSeries.length > 1 && <Sparkline data={spendSeries} />}
            </div>
            {budget && (
              <>
                <div className="row between" style={{ margin: "12px 0 8px" }}>
                  <span className="t-h2 mono"><CountUp value={budget.spentWeekUsd} prefix="$" /></span>
                  <span className="t-sm muted">{usd(budget.remainingWeekUsd)} left</span>
                </div>
                <FuelGauge spent={budget.spentWeekUsd} cap={budget.settings.weeklyCapUsd} projected={0} />
                <div className="hr" style={{ margin: "14px 0" }} />
                <div className="row between t-xs mono">
                  <span className="muted">Team pool this month</span>
                  <span>
                    {usd(budget.spentMonthUsd)} / {usd(budget.settings.monthlyPoolUsd, 0)}
                  </span>
                </div>
                {budget.suggestEconomize && (
                  <p className="t-xs" style={{ color: "var(--warn-tx)", marginTop: 10 }}>
                    ⚠️ Budget running hot — explore at low quality / Fast lane, commit the keeper render once.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card>
            <div className="card-hd">
              <span className="t-h3">Needs scoring</span>
              {unscored.length > 0 && <span className="pill accent"><span className="led" />{unscored.length}</span>}
            </div>
            <div className="card-pad col gap2">
              {unscored.length === 0 ? (
                <p className="t-sm muted">Everything&apos;s scored. ✅</p>
              ) : (
                unscored.slice(0, 4).map((a) => (
                  <Link key={a.id} href="/gallery" className="linerow click" style={glowVars(a.job_id)}>
                    <Media src={a.blob_url} kind={a.content_type} hueKey={a.job_id} style={{ width: 44, flex: "none" }} />
                    <div className="grow">
                      <div className="t-sm" style={{ fontWeight: 600 }}>
                        Render #{a.id}
                      </div>
                      <div className="t-xs muted">{relTime(a.created_at)} · waiting on the gate</div>
                    </div>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card pad>
            <span className="t-label">What&apos;s next</span>
            <div className="col gap2" style={{ marginTop: 12 }}>
              {unscored.length > 0 && (
                <Link href="/gallery" className="linerow click">
                  <span className="grow t-sm" style={{ fontWeight: 600 }}>
                    Review {unscored.length} render{unscored.length > 1 ? "s" : ""}
                  </span>
                  <Icon name="arrowRight" size={15} />
                </Link>
              )}
              <Link href="/create" className="linerow click">
                <span className="grow t-sm" style={{ fontWeight: 600 }}>
                  Start a new generation
                </span>
                <Icon name="arrowRight" size={15} />
              </Link>
              <Link href="/gallery" className="linerow click">
                <span className="grow t-sm" style={{ fontWeight: 600 }}>
                  Organize the gallery
                </span>
                <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

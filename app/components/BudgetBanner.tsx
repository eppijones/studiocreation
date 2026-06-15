"use client";

export interface BudgetView {
  settings: {
    weeklyCapUsd: number;
    monthlyPoolUsd: number;
    perOperatorWeeklyUsd: number;
    confirmThresholdUsd: number;
  };
  spentWeekUsd: number;
  spentMonthUsd: number;
  operatorWeekUsd: number;
  remainingWeekUsd: number;
  remainingMonthUsd: number;
  jobsWeek: number;
  avgJobUsd: number;
  projectedWeekUsd: number;
  level: "ok" | "notice" | "warn" | "blocked";
  message: string;
  suggestEconomize: boolean;
}

const LEVEL_ICON = { ok: "💰", notice: "💡", warn: "⚠️", blocked: "⛔" } as const;

export default function BudgetBanner({
  budget,
}: {
  budget: BudgetView | null;
}) {
  if (!budget) return null;
  const weekPct = Math.min((budget.spentWeekUsd / budget.settings.weeklyCapUsd) * 100, 100);
  const monthPct = Math.min((budget.spentMonthUsd / budget.settings.monthlyPoolUsd) * 100, 100);

  return (
    <div className={`banner level-${budget.level}`}>
      <span>
        {LEVEL_ICON[budget.level]} {budget.message}
      </span>
      <span>
        week ${budget.spentWeekUsd.toFixed(2)}/{budget.settings.weeklyCapUsd.toFixed(2)} · pool $
        {budget.spentMonthUsd.toFixed(2)}/{budget.settings.monthlyPoolUsd.toFixed(0)} · you $
        {budget.operatorWeekUsd.toFixed(2)}
      </span>
      {budget.jobsWeek > 0 && (
        <span className="banner-proj">
          📈 ≈ ${budget.projectedWeekUsd.toFixed(2)}/week at this pace · {budget.jobsWeek} job
          {budget.jobsWeek === 1 ? "" : "s"} · ${budget.avgJobUsd.toFixed(3)}/job avg
        </span>
      )}
      <div className="cap-bar">
        <div style={{ width: `${weekPct}%` }} />
      </div>
      <div className="cap-bar pool">
        <div style={{ width: `${monthPct}%` }} />
      </div>
      {budget.suggestEconomize && (
        <span className="banner-hint">
          Budget is running hot — lock the shot first (explore on GPT Image 2 low / Fast lane),
          then commit the keeper render once.
        </span>
      )}
    </div>
  );
}

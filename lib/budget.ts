import { sql } from "./db";
import { getBudgetSettings, type BudgetSettings } from "./settings";

export type BudgetLevel = "ok" | "notice" | "warn" | "blocked";

export interface BudgetState {
  settings: BudgetSettings;
  spentWeekUsd: number;
  spentMonthUsd: number;
  operatorWeekUsd: number;
  remainingWeekUsd: number;
  remainingMonthUsd: number;
  /** jobs logged so far this week (non-error) — the sample the projection is built from */
  jobsWeek: number;
  /** mean cost per job this week, 0 until the first generation lands */
  avgJobUsd: number;
  /** run-rate forecast of total spend by the end of the UTC week at the current pace */
  projectedWeekUsd: number;
  /** worst of the weekly / monthly / per-operator signals */
  level: BudgetLevel;
  /** human message the UI shows next to the level */
  message: string;
  /** true → the pool is hot; nudge operators to lock the shot before committing a render */
  suggestEconomize: boolean;
}

/** Pure cap→level mapping (exported for unit tests). */
export function levelFor(spent: number, cap: number, s: BudgetSettings): BudgetLevel {
  if (cap <= 0) return "ok";
  if (spent >= cap) return "blocked";
  if (spent >= cap * s.warnPct) return "warn";
  if (spent >= cap * s.noticePct) return "notice";
  return "ok";
}

const LEVEL_RANK: Record<BudgetLevel, number> = { ok: 0, notice: 1, warn: 2, blocked: 3 };

/** Shared spend state across the team — estimates until reconciled, UTC week / calendar month. */
export async function getBudgetState(operator?: string): Promise<BudgetState> {
  const settings = await getBudgetSettings();
  const rows = await sql`
    SELECT
      COALESCE(SUM(COALESCE(actual_usd, est_usd)) FILTER (
        WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'utc')), 0) AS week,
      COALESCE(SUM(COALESCE(actual_usd, est_usd)) FILTER (
        WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'utc')), 0) AS month,
      COALESCE(SUM(COALESCE(actual_usd, est_usd)) FILTER (
        WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'utc')
          AND operator = ${operator ?? ""}), 0) AS op_week,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'utc')) AS jobs_week,
      MIN(created_at) FILTER (
        WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'utc')) AS first_week
    FROM jobs
    WHERE status NOT IN ('error', 'canceled')
  `;
  const spentWeekUsd = Number(rows[0].week);
  const spentMonthUsd = Number(rows[0].month);
  const operatorWeekUsd = Number(rows[0].op_week);
  const jobsWeek = Number(rows[0].jobs_week);
  const firstWeekMs = rows[0].first_week ? new Date(rows[0].first_week as string).getTime() : null;

  const avgJobUsd = jobsWeek > 0 ? spentWeekUsd / jobsWeek : 0;
  const projectedWeekUsd = projectWeeklySpend(spentWeekUsd, firstWeekMs);

  const weekLevel = levelFor(spentWeekUsd, settings.weeklyCapUsd, settings);
  const monthLevel = levelFor(spentMonthUsd, settings.monthlyPoolUsd, settings);
  const opLevel = levelFor(operatorWeekUsd, settings.perOperatorWeeklyUsd, settings);

  let level = weekLevel;
  let message = `$${spentWeekUsd.toFixed(2)} of $${settings.weeklyCapUsd.toFixed(2)} weekly cap`;
  if (LEVEL_RANK[monthLevel] > LEVEL_RANK[level]) {
    level = monthLevel;
    message = `team pool: $${spentMonthUsd.toFixed(2)} of $${settings.monthlyPoolUsd.toFixed(2)} this month`;
  }
  if (LEVEL_RANK[opLevel] > LEVEL_RANK[level] && opLevel !== "blocked") {
    // per-operator cap is a nudge, never a wall — cap the signal at "warn"
    level = opLevel === "warn" ? "warn" : opLevel;
    message = `you've spent $${operatorWeekUsd.toFixed(2)} this week (personal guide: $${settings.perOperatorWeeklyUsd.toFixed(2)})`;
  }

  return {
    settings,
    spentWeekUsd,
    spentMonthUsd,
    operatorWeekUsd,
    remainingWeekUsd: Math.max(settings.weeklyCapUsd - spentWeekUsd, 0),
    remainingMonthUsd: Math.max(settings.monthlyPoolUsd - spentMonthUsd, 0),
    jobsWeek,
    avgJobUsd,
    projectedWeekUsd,
    level,
    message,
    suggestEconomize: LEVEL_RANK[level] >= LEVEL_RANK.warn,
  };
}

/**
 * Forecast end-of-week spend from the pace observed since the first job this week.
 * Measuring from the first job (not the week boundary) keeps a short burst from
 * implying a huge week; the elapsed window is floored at 1h so the very first
 * generation doesn't divide by ~0 and project an absurd rate.
 */
function projectWeeklySpend(spentWeekUsd: number, firstWeekMs: number | null): number {
  if (spentWeekUsd <= 0 || firstWeekMs == null) return spentWeekUsd;
  const now = Date.now();
  // End of the UTC ISO week = upcoming Monday 00:00 UTC (date_trunc('week') anchors on Monday).
  const d = new Date();
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysUntilNextMonday = ((8 - dow) % 7) || 7;
  const endOfUtcWeek = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + daysUntilNextMonday,
    0,
    0,
    0
  );
  const elapsedH = Math.max((now - firstWeekMs) / 3_600_000, 1);
  const remainingH = Math.max((endOfUtcWeek - now) / 3_600_000, 0);
  const ratePerH = spentWeekUsd / elapsedH;
  return spentWeekUsd + ratePerH * remainingH;
}

import { sql } from "./db";
import { DAILY_CAP_USD } from "./pricing";

export interface BudgetState {
  spentTodayUsd: number;
  capUsd: number;
  remainingUsd: number;
  warn: boolean;
}

/** Shared daily spend across all operators, UTC day, estimates until reconciled. */
export async function getBudgetState(): Promise<BudgetState> {
  const rows = await sql`
    SELECT COALESCE(SUM(COALESCE(actual_usd, est_usd)), 0) AS spent
    FROM jobs
    WHERE status != 'error'
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc')
  `;
  const spent = Number(rows[0].spent);
  const remaining = Math.max(DAILY_CAP_USD - spent, 0);
  return {
    spentTodayUsd: spent,
    capUsd: DAILY_CAP_USD,
    remainingUsd: remaining,
    warn: spent >= DAILY_CAP_USD * 0.75,
  };
}

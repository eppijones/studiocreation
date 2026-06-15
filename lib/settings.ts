import { sql } from "./db";
import defaults from "@/config/budget.json";

if (typeof window !== "undefined") {
  throw new Error("lib/settings.ts was imported in a client bundle");
}

export interface BudgetSettings {
  /** Shared cap per UTC week (Mon–Sun), all operators combined — the hard stop. */
  weeklyCapUsd: number;
  /** Team pool per calendar month — the hard stop finance signs off on. */
  monthlyPoolUsd: number;
  /** Per-operator soft cap per week — frequency guardrail, not a wall. */
  perOperatorWeeklyUsd: number;
  /** Per-job explicit-confirm threshold. */
  confirmThresholdUsd: number;
  /** Fraction of a cap where the UI shifts to "heads-up" messaging. */
  noticePct: number;
  /** Fraction of a cap where the UI switches to "lock the shot, render once." */
  warnPct: number;
}

export const DEFAULT_BUDGET: BudgetSettings = defaults as BudgetSettings;

export async function getBudgetSettings(): Promise<BudgetSettings> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'budget'`;
    if (rows[0]?.value) {
      return { ...DEFAULT_BUDGET, ...(rows[0].value as Partial<BudgetSettings>) };
    }
  } catch {
    // settings table missing (pre-migration) — fall through to defaults
  }
  return DEFAULT_BUDGET;
}

export async function saveBudgetSettings(
  patch: Partial<BudgetSettings>,
  updatedBy: string
): Promise<BudgetSettings> {
  const current = await getBudgetSettings();
  const next: BudgetSettings = { ...current };

  const numericKeys: (keyof BudgetSettings)[] = [
    "weeklyCapUsd",
    "monthlyPoolUsd",
    "perOperatorWeeklyUsd",
    "confirmThresholdUsd",
    "noticePct",
    "warnPct",
  ];
  for (const key of numericKeys) {
    const v = patch[key];
    if (v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0) {
      next[key] = Number(v);
    }
  }
  next.noticePct = Math.min(next.noticePct, 1);
  next.warnPct = Math.min(next.warnPct, 1);

  await sql`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES ('budget', ${JSON.stringify(next)}::jsonb, ${updatedBy}, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
  `;
  return next;
}

export interface StudioSettings {
  /** Auto-rate every completed render against its prompt with a vision LLM. Off by default — it costs a few cents per render. */
  autoScore: boolean;
}

export const DEFAULT_STUDIO: StudioSettings = { autoScore: false };

export async function getStudioSettings(): Promise<StudioSettings> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'studio'`;
    if (rows[0]?.value) {
      return { ...DEFAULT_STUDIO, ...(rows[0].value as Partial<StudioSettings>) };
    }
  } catch {
    // settings table missing (pre-migration) — fall through to defaults
  }
  return DEFAULT_STUDIO;
}

export async function saveStudioSettings(
  patch: Partial<StudioSettings>,
  updatedBy: string
): Promise<StudioSettings> {
  const current = await getStudioSettings();
  const next: StudioSettings = { ...current };
  if (typeof patch.autoScore === "boolean") next.autoScore = patch.autoScore;

  await sql`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES ('studio', ${JSON.stringify(next)}::jsonb, ${updatedBy}, now())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
  `;
  return next;
}

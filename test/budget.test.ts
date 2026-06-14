import { describe, it, expect } from "vitest";
import { levelFor } from "@/lib/budget";
import type { BudgetSettings } from "@/lib/settings";

const S: BudgetSettings = {
  weeklyCapUsd: 50,
  monthlyPoolUsd: 120,
  perOperatorWeeklyUsd: 50,
  confirmThresholdUsd: 1.25,
  noticePct: 0.6,
  warnPct: 0.85,
};

describe("levelFor() — cap → level", () => {
  it("is ok well under the notice threshold", () => {
    expect(levelFor(10, 50, S)).toBe("ok");
  });
  it("notices at 60% of cap", () => {
    expect(levelFor(30, 50, S)).toBe("notice"); // 0.6 × 50
    expect(levelFor(29.99, 50, S)).toBe("ok");
  });
  it("warns at 85% of cap", () => {
    expect(levelFor(42.5, 50, S)).toBe("warn"); // 0.85 × 50
  });
  it("blocks at or above the cap", () => {
    expect(levelFor(50, 50, S)).toBe("blocked");
    expect(levelFor(75, 50, S)).toBe("blocked");
  });
  it("treats a non-positive cap as ok (disabled)", () => {
    expect(levelFor(100, 0, S)).toBe("ok");
  });
});

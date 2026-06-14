import { describe, it, expect } from "vitest";
import { fallbackDurationMs, clampEtaMs } from "@/lib/eta";

const IMG = "openai/gpt-image-2";
const VID = "fal-ai/kling-video/v3/pro/text-to-video";

describe("fallbackDurationMs()", () => {
  it("guesses longer for video than image", () => {
    expect(fallbackDurationMs(VID)).toBe(90_000);
    expect(fallbackDurationMs(IMG)).toBe(22_000);
  });
});

describe("clampEtaMs()", () => {
  it("keeps a sane value untouched", () => {
    expect(clampEtaMs(IMG, 30_000)).toBe(30_000);
  });
  it("floors below the per-kind minimum", () => {
    expect(clampEtaMs(IMG, 1_000)).toBe(6_000);
    expect(clampEtaMs(VID, 1_000)).toBe(15_000);
  });
  it("caps poisoned multi-hour medians", () => {
    expect(clampEtaMs(IMG, 5 * 3_600_000)).toBe(240_000);
    expect(clampEtaMs(VID, 5 * 3_600_000)).toBe(600_000);
  });
  it("falls back on non-finite / non-positive input", () => {
    expect(clampEtaMs(VID, NaN)).toBe(90_000);
    expect(clampEtaMs(VID, 0)).toBe(90_000);
    expect(clampEtaMs(IMG, -5)).toBe(22_000);
  });
});

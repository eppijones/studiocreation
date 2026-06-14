import { describe, it, expect } from "vitest";
import {
  estimate,
  coerceSeconds,
  defaultSeconds,
  listModels,
  getModel,
  type DurationSpec,
} from "@/lib/pricing";

describe("estimate()", () => {
  it("prices the default image model at quality=high", () => {
    const e = estimate({ provider: "fal", model: "openai/gpt-image-2", count: 1, quality: "high" });
    expect(e.usd).toBeCloseTo(0.16, 5);
    expect(e.unit).toBe("image");
  });

  it("honours off-spec quality overrides (low/medium)", () => {
    expect(estimate({ provider: "fal", model: "openai/gpt-image-2", count: 1, quality: "low" }).usd).toBeCloseTo(0.01, 5);
    expect(estimate({ provider: "fal", model: "openai/gpt-image-2", count: 1, quality: "medium" }).usd).toBeCloseTo(0.06, 5);
  });

  it("applies the 4k tier and multiplies by count", () => {
    const e = estimate({ provider: "fal", model: "openai/gpt-image-2", count: 3, tier: "4k" });
    expect(e.unitUsd).toBeCloseTo(0.41, 5);
    expect(e.usd).toBeCloseTo(1.23, 5);
  });

  it("prices video per second and adds audio rate", () => {
    const base = estimate({ provider: "fal", model: "fal-ai/kling-video/v3/pro/text-to-video", count: 5 });
    expect(base.usd).toBeCloseTo(0.7, 5); // 5 × $0.14
    const withAudio = estimate({ provider: "fal", model: "fal-ai/kling-video/v3/pro/text-to-video", count: 5, audio: true });
    expect(withAudio.usd).toBeCloseTo(1.05, 5); // 5 × $0.21
  });

  it("applies the Seedance fast lane rate", () => {
    const e = estimate({ provider: "fal", model: "bytedance/seedance-2.0/text-to-video", count: 5, fast: true });
    expect(e.unitUsd).toBeCloseTo(0.2419, 5);
  });

  it("throws on an unknown model", () => {
    expect(() => estimate({ provider: "fal", model: "nope/not-real", count: 1 })).toThrow(/Unknown model/);
  });
});

describe("coerceSeconds()", () => {
  it("snaps to the nearest discrete value", () => {
    const d: DurationSpec = { mode: "discrete", values: [4, 6, 8] };
    expect(coerceSeconds(d, 5)).toBe(4);
    expect(coerceSeconds(d, 7)).toBe(6);
    expect(coerceSeconds(d, 100)).toBe(8);
  });

  it("clamps within a range", () => {
    const d: DurationSpec = { mode: "range", min: 3, max: 15 };
    expect(coerceSeconds(d, 1)).toBe(3);
    expect(coerceSeconds(d, 20)).toBe(15);
    expect(coerceSeconds(d, 7)).toBe(7);
  });

  it("passes through for image (mode=none)", () => {
    expect(coerceSeconds({ mode: "none" }, 9)).toBe(9);
  });
});

describe("defaultSeconds()", () => {
  it("prefers an explicit default, else first/min", () => {
    expect(defaultSeconds({ mode: "discrete", values: [4, 6, 8], default: 6 })).toBe(6);
    expect(defaultSeconds({ mode: "discrete", values: [5, 10] })).toBe(5);
    expect(defaultSeconds({ mode: "range", min: 3, max: 15 })).toBe(3);
  });
});

describe("registry constraints (single source of truth)", () => {
  it("derives ModelInfo for every model with sane shapes", () => {
    const models = listModels();
    expect(models.length).toBeGreaterThan(10);
    for (const m of models) {
      expect(m.id).toBeTruthy();
      expect(m.numImages.max).toBeGreaterThanOrEqual(m.numImages.min);
    }
  });

  it("edit models that omit ratios expose no aspect control", () => {
    const qwenEdit = getModel("fal-ai/qwen-image-2/edit");
    expect(qwenEdit?.ratios).toEqual([]);
    expect(qwenEdit?.requiresRef).toBe(true);
  });

  it("marks reference-to-video as requiring a reference, with typed caps", () => {
    const ref = getModel("bytedance/seedance-2.0/reference-to-video");
    expect(ref?.requiresRef).toBe(true);
    expect(ref?.refImages).toBe(9);
    expect(ref?.refVideos).toBe(3);
    expect(ref?.refAudio).toBe(3);
  });

  it("keeps finishing models out by tier but resolvable by id", () => {
    expect(getModel("fal-ai/topaz/upscale/video")?.tier).toBe("finish");
  });
});

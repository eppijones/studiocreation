import { describe, it, expect } from "vitest";
import {
  DELIVERY_PRESETS,
  COLOR_LOOKS,
  lookVf,
  ffmpegCommand,
  ffmpegImageCommand,
  buildFinishPlan,
  type DeliveryPreset,
} from "@/lib/finishing";

const byId = (id: string): DeliveryPreset => {
  const p = DELIVERY_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`no preset ${id}`);
  return p;
};

describe("DELIVERY_PRESETS", () => {
  it("have unique ids and sane dimensions", () => {
    const ids = DELIVERY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of DELIVERY_PRESETS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(["crop", "pad"]).toContain(p.fit);
      expect(p.fps).toBeGreaterThan(0);
    }
  });
  it("ship the key platform formats", () => {
    expect(byId("tiktok").ratio).toBe("9:16");
    expect(byId("ig-feed").ratio).toBe("4:5");
    expect(byId("square").width).toBe(byId("square").height);
  });
});

describe("ffmpegCommand (video recipe)", () => {
  it("crops-to-fill for crop presets and sets the fps", () => {
    const cmd = ffmpegCommand(byId("tiktok"), "https://blob/x.mp4", "out.mp4");
    expect(cmd).toContain("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");
    expect(cmd).toContain("fps=30");
    expect(cmd).toContain("-r 30");
    expect(cmd).toContain("libx264");
  });
  it("letterboxes (pad) for pad presets", () => {
    const cmd = ffmpegCommand(byId("scope-letterbox"), "https://blob/x.mp4", "out.mp4");
    expect(cmd).toContain("pad=3840:2160");
    expect(cmd).toContain("crop=3840:1634");
  });
  it("prepends an optional color grade before the scale", () => {
    const grade = lookVf("teal-orange");
    const cmd = ffmpegCommand(byId("yt-hd"), "https://blob/x.mp4", "out.mp4", grade);
    expect(cmd).toContain(`-vf "${grade},scale=1920:1080`);
  });
  it("omits the grade when none is given", () => {
    const cmd = ffmpegCommand(byId("yt-hd"), "https://blob/x.mp4", "out.mp4");
    expect(cmd).toContain('-vf "scale=1920:1080');
    expect(cmd).not.toContain("colorbalance");
  });
});

describe("ffmpegImageCommand (image recipe)", () => {
  it("scales without fps/audio and honours the grade", () => {
    const cmd = ffmpegImageCommand(byId("square"), "https://blob/x.png", "out.png", lookVf("bw"));
    expect(cmd).toContain("hue=s=0");
    expect(cmd).toContain("scale=1080:1080");
    expect(cmd).not.toContain("libx264");
    expect(cmd).toContain("-q:v 1");
  });
});

describe("COLOR_LOOKS / lookVf", () => {
  it("maps known looks to a filtergraph and none/unknown to empty", () => {
    expect(lookVf("none")).toBe("");
    expect(lookVf(undefined)).toBe("");
    expect(lookVf("does-not-exist")).toBe("");
    expect(lookVf("warm")).toContain("eq=");
    expect(COLOR_LOOKS[0].id).toBe("none");
    expect(new Set(COLOR_LOOKS.map((l) => l.id)).size).toBe(COLOR_LOOKS.length);
  });
});

describe("buildFinishPlan", () => {
  it("video 4k clamps factor + fps and derives count from duration", () => {
    const plan = buildFinishPlan("upscale-video-4k", "https://blob/x.mp4", { durationS: 7.2, targetFps: 120, upscaleFactor: 9 });
    expect(plan.model).toBe("fal-ai/topaz/upscale/video");
    expect(plan.input.upscale_factor).toBe(4); // clamped to 4
    expect(plan.input.target_fps).toBe(60); // clamped to 60
    expect(plan.count).toBe(8); // ceil(7.2)
  });
  it("video 4k floors fps to 16 and count to >=1", () => {
    const plan = buildFinishPlan("upscale-video-4k", "u", { durationS: 0, targetFps: 1 });
    expect(plan.input.target_fps).toBe(16);
    expect(plan.count).toBe(1);
  });
  it("image 4k and crisp route to the right models, count 1", () => {
    expect(buildFinishPlan("upscale-image-4k", "u", {}).model).toBe("fal-ai/topaz/upscale/image");
    expect(buildFinishPlan("upscale-image-4k", "u", {}).count).toBe(1);
    expect(buildFinishPlan("upscale-image-crisp", "u", {}).model).toBe("fal-ai/recraft/upscale/crisp");
  });
});

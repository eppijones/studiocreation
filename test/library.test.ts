import { describe, it, expect } from "vitest";
import { kindForExt, extOf, isIgnoredPath } from "../studiolibrary/lib/config/index";
import { makeEncoder } from "../studiolibrary/lib/encoders/index";

describe("library file-kind detection", () => {
  it("maps known extensions to asset kinds", () => {
    expect(kindForExt("mp4")).toBe("video");
    expect(kindForExt("MOV")).toBe("video");
    expect(kindForExt("mxf")).toBe("video");
    expect(kindForExt("png")).toBe("image");
    expect(kindForExt("wav")).toBe("audio");
    expect(kindForExt("mp3")).toBe("audio");
    expect(kindForExt("pdf")).toBe("doc");
    expect(kindForExt("prproj")).toBe("project");
    expect(kindForExt("psb")).toBe("project");
  });
  it("returns null for unindexed extensions", () => {
    expect(kindForExt("txt")).toBeNull();
    expect(kindForExt("")).toBeNull();
    expect(kindForExt("exe")).toBeNull();
  });
  it("extracts the lowercased extension", () => {
    expect(extOf("a/b/Clip.MP4")).toBe("mp4");
    expect(extOf("noext")).toBe("");
    expect(extOf("dir.with.dots/file.TIFF")).toBe("tiff");
  });
  it("ignores hidden / junk / sidecar files", () => {
    expect(isIgnoredPath(".DS_Store")).toBe(true);
    expect(isIgnoredPath("__MACOSX")).toBe(true);
    expect(isIgnoredPath("render.part")).toBe(true);
    expect(isIgnoredPath("Thumbs.db")).toBe(true);
    expect(isIgnoredPath("Clip.mp4")).toBe(false);
  });
});

describe("encoder adapter (the dev→Oslo config swap)", () => {
  it("videotoolbox supplies hardware H.264 args with a dense GOP", () => {
    const enc = makeEncoder("videotoolbox");
    expect(enc.id).toBe("videotoolbox");
    const args = enc.videoArgs({ maxHeight: 1080, bitrate: "6M", maxrate: "9M", gopFrames: 30 });
    expect(args).toContain("h264_videotoolbox");
    expect(args).toContain("6M");
    expect(args[args.indexOf("-g") + 1]).toBe("30");
  });
  it("nvenc (Oslo) swaps in h264_nvenc with NVDEC decode — same interface", () => {
    const enc = makeEncoder("nvenc");
    expect(enc.id).toBe("nvenc");
    expect(enc.videoArgs({ maxHeight: 1080, bitrate: "6M", maxrate: "9M", gopFrames: 24 })).toContain("h264_nvenc");
    expect(enc.inputArgs()).toContain("cuda");
  });
  it("windows fallback is software x264 so the pipeline never hard-stops", () => {
    const enc = makeEncoder("windows-ffmpeg");
    expect(enc.videoArgs({ maxHeight: 1080, bitrate: "6M", maxrate: "9M", gopFrames: 24 })).toContain("libx264");
  });
});

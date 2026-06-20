import { describe, it, expect } from "vitest";
import { LocalVolume } from "../studiolibrary/lib/volumes/local";
import { isWritable } from "../studiolibrary/lib/volumes/types";
import { cronMatches } from "../studiolibrary/lib/automation";

describe("volume writability + path safety", () => {
  it("a read-only local volume is not writable and rejects mutations", async () => {
    const ro = new LocalVolume("ro", "/tmp/lib-ro", false);
    expect(ro.writable).toBe(false);
    expect(isWritable(ro)).toBe(false);
    await expect(ro.move("a.mp4", "b.mp4")).rejects.toThrow(/read-only/);
  });

  it("an explicitly-writable local volume reports writable", () => {
    const rw = new LocalVolume("rw", "/tmp/lib-rw", true);
    expect(rw.writable).toBe(true);
    expect(isWritable(rw)).toBe(true);
  });

  it("absPath refuses to escape the volume root (traversal guard)", () => {
    const v = new LocalVolume("v", "/tmp/lib-root", true);
    expect(() => v.absPath("../etc/passwd")).toThrow(/escapes/);
    expect(() => v.absPath("a/../../b")).toThrow(/escapes/);
    expect(v.absPath("Media/clip.mp4")).toBe("/tmp/lib-root/Media/clip.mp4");
  });
});

describe("automation cron matcher", () => {
  const at = (h: number, m: number) => new Date(2026, 5, 20, h, m, 0); // local time
  it("matches an exact nightly schedule", () => {
    expect(cronMatches("0 2 * * *", at(2, 0))).toBe(true);
    expect(cronMatches("0 2 * * *", at(2, 1))).toBe(false);
    expect(cronMatches("0 2 * * *", at(3, 0))).toBe(false);
  });
  it("matches step syntax every 15 minutes", () => {
    expect(cronMatches("*/15 * * * *", at(9, 0))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(9, 15))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(9, 30))).toBe(true);
    expect(cronMatches("*/15 * * * *", at(9, 7))).toBe(false);
  });
  it("matches hourly and rejects malformed crons", () => {
    expect(cronMatches("0 * * * *", at(14, 0))).toBe(true);
    expect(cronMatches("0 * * * *", at(14, 30))).toBe(false);
    expect(cronMatches("not a cron", at(0, 0))).toBe(false);
    expect(cronMatches("0 2 *", at(2, 0))).toBe(false);
  });
});

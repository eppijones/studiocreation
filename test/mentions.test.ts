import { describe, it, expect } from "vitest";
import { parseMentions } from "@/studiolibrary/lib/mentions";

describe("parseMentions", () => {
  it("extracts a single handle", () => {
    expect(parseMentions("hey @maya can you look at this")).toEqual(["maya"]);
  });

  it("extracts multiple distinct handles, lowercased", () => {
    expect(parseMentions("@Maya and @Jon-K please review")).toEqual(["maya", "jon-k"]);
  });

  it("dedupes repeated handles", () => {
    expect(parseMentions("@maya @maya @maya")).toEqual(["maya"]);
  });

  it("ignores email addresses (no false mention of the domain)", () => {
    expect(parseMentions("send to maya@studio.com")).toEqual([]);
  });

  it("handles start-of-string mentions", () => {
    expect(parseMentions("@lead ship it")).toEqual(["lead"]);
  });

  it("trims trailing punctuation", () => {
    expect(parseMentions("ping @maya, @jon.")).toEqual(["maya", "jon"]);
  });

  it("returns [] for empty / null", () => {
    expect(parseMentions("")).toEqual([]);
    expect(parseMentions(null)).toEqual([]);
    expect(parseMentions(undefined)).toEqual([]);
  });

  it("ignores a bare @ with no handle", () => {
    expect(parseMentions("email me @ noon")).toEqual([]);
  });
});

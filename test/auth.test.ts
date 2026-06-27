import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  createUserSessionToken,
  verifyUserSessionToken,
  parseRole,
  SESSION_MAX_AGE_MS,
} from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips a freshly issued token", async () => {
    const t = await createSessionToken("hunter2");
    expect(await verifySessionToken(t, "hunter2")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const t = await createSessionToken("hunter2");
    expect(await verifySessionToken(t, "nope")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const t = await createSessionToken("hunter2");
    const tampered = t.slice(0, -1) + (t.endsWith("0") ? "1" : "0");
    expect(await verifySessionToken(tampered, "hunter2")).toBe(false);
  });

  it("rejects an expired token", async () => {
    const old = Date.now() - SESSION_MAX_AGE_MS - 1000;
    const t = await createSessionToken("hunter2", old);
    expect(await verifySessionToken(t, "hunter2")).toBe(false);
  });

  it("rejects a far-future-dated token", async () => {
    const future = Date.now() + 1000 * 60 * 60; // +1h, beyond skew grace
    const t = await createSessionToken("hunter2", future);
    expect(await verifySessionToken(t, "hunter2")).toBe(false);
  });

  it("rejects empty / malformed tokens", async () => {
    expect(await verifySessionToken(undefined, "x")).toBe(false);
    expect(await verifySessionToken("", "x")).toBe(false);
    expect(await verifySessionToken("garbage-no-dot", "x")).toBe(false);
  });
});

describe("parseRole", () => {
  it("accepts known roles and defaults the rest to creative", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("finance")).toBe("finance");
    expect(parseRole("nonsense")).toBe("creative");
    expect(parseRole(undefined)).toBe("creative");
  });
});

describe("per-user session tokens", () => {
  const secret = "server-secret";
  const claims = { uid: 42, role: "producer" as const, tv: 3 };

  it("round-trips identity claims", async () => {
    const t = await createUserSessionToken(claims, secret);
    const out = await verifyUserSessionToken(t, secret);
    expect(out).toMatchObject({ uid: 42, role: "producer", tv: 3 });
    expect(typeof out?.iat).toBe("number");
  });

  it("rejects the wrong secret", async () => {
    const t = await createUserSessionToken(claims, secret);
    expect(await verifyUserSessionToken(t, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const t = await createUserSessionToken(claims, secret);
    const [payload, sig] = t.split(".");
    // flip a char in the payload — signature no longer matches
    const bad = payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A") + "." + sig;
    expect(await verifyUserSessionToken(bad, secret)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const old = Date.now() - SESSION_MAX_AGE_MS - 1000;
    const t = await createUserSessionToken({ ...claims, iat: old }, secret);
    expect(await verifyUserSessionToken(t, secret)).toBeNull();
  });

  it("rejects empty / malformed tokens", async () => {
    expect(await verifyUserSessionToken(undefined, secret)).toBeNull();
    expect(await verifyUserSessionToken("", secret)).toBeNull();
    expect(await verifyUserSessionToken("no-dot", secret)).toBeNull();
  });

  it("normalizes an unknown role to creative", async () => {
    const t = await createUserSessionToken({ uid: 1, role: "wizard" as never, tv: 0 }, secret);
    const out = await verifyUserSessionToken(t, secret);
    expect(out?.role).toBe("creative");
  });
});

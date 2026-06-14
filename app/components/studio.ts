/** Client-safe studio helpers: per-asset colour identity, money formatting,
 *  theme toggle, time. No server-only imports. */

/** Stable hash of a string → 0..360 hue, so each employee/asset keeps its colour. */
export function hueFor(key: string | number | null | undefined): number {
  const s = String(key ?? "studio");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** [p0, p1] glow colours derived from a hue — drive the gradient-glow shadows. */
export function paletteFor(key: string | number | null | undefined): [string, string] {
  const h = hueFor(key);
  return [`oklch(0.64 0.21 ${h})`, `oklch(0.52 0.2 ${(h + 60) % 360})`];
}

/** Inline style vars for a glowing tile/row. */
export function glowVars(key: string | number | null | undefined): React.CSSProperties {
  const [p0, p1] = paletteFor(key);
  return { "--p0": p0, "--p1": p1, "--hue": hueFor(key) } as React.CSSProperties;
}

/** Smart money: 3 decimals under $1, else 2. */
export function money(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return n < 1 && n > 0 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}
export function usd(n: number, decimals = 2): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(decimals)}`;
}

/** fal endpoint / model id → short label. */
export function modelShort(model: string): string {
  return model.replace(/^fal-ai\//, "").replace(/^openai\//, "").replace(/^bytedance\//, "");
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ---------- shared client job shape (mirrors GET /api/jobs) ---------- */
export type JobStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface ClientJobAsset {
  id: number;
  blob_url: string;
  content_type: string | null;
  score?: number | null;
}

export interface ClientJob {
  id: number;
  model: string;
  prompt: string;
  status: JobStatus;
  est_usd: string;
  operator: string;
  project: string;
  label: string;
  error: string | null;
  created_at: string;
  completed_at?: string | null;
  request_id?: string | null;
  assets: ClientJobAsset[];
  /** Progress hints, present only while in flight. */
  medianMs?: number;
  samples?: number;
  elapsedMs?: number;
  etaMs?: number;
  queuePosition?: number | null;
}

export const isInFlight = (s: string): boolean => s === "queued" || s === "running";

/** Cancel an in-flight job. Returns the resulting status, or null on failure. */
export async function cancelJob(id: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return "canceled";
    // 409 → job already finished/failed in the race; surface its real status.
    return typeof data.status === "string" ? data.status : null;
  } catch {
    return null;
  }
}

export type Skin = "onyx" | "lumen";

export function getSkin(): Skin {
  if (typeof document === "undefined") return "onyx";
  return document.documentElement.getAttribute("data-skin") === "lumen" ? "lumen" : "onyx";
}

export function setSkin(skin: Skin): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-skin", skin);
  document.cookie = `studio_skin=${skin}; path=/; max-age=31536000; samesite=lax`;
}

export function toggleSkin(): Skin {
  const next: Skin = getSkin() === "lumen" ? "onyx" : "lumen";
  setSkin(next);
  return next;
}

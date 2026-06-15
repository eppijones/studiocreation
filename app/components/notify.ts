"use client";

/** Browser/OS notification + sound helpers for job completion pings. */

export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Ask once, lazily — call on first Generate so the prompt has user intent behind it. */
export function ensureNotifyPermission(): void {
  if (!canNotify()) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function osNotify(title: string, body: string): void {
  if (!canNotify() || Notification.permission !== "granted") return;
  // Skip the OS toast when the tab is already focused — the in-app toast covers it.
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/icon.svg", tag: "studio-job" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notification construction can throw on some platforms */
  }
}

let audioCtx: AudioContext | null = null;

/** Soft two-note "ready" chime via WebAudio — no asset to load. */
export function chime(kind: "done" | "error" = "done"): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const notes = kind === "done" ? [660, 990] : [330, 247];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.13;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    /* audio blocked — silent fallback */
  }
}

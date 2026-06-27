/**
 * Outbound webhooks (Phase 4) — push notable events to a Slack/Discord incoming
 * webhook. URL is a SERVER-ONLY env var (never in code/logs/client). One payload
 * shape (`{text, content}`) works for both: Slack reads `text`, Discord `content`.
 * Best-effort: a webhook failure never affects the primary action.
 */

const WEBHOOK_URL = () => process.env.STUDIO_WEBHOOK_URL || "";

/** Event types worth pushing externally (skip the noisy per-comment stream). */
const PUSH_TYPES = new Set(["review_state", "share_comment", "job_error"]);

export interface WebhookEvent {
  type: string;
  title: string;
  body?: string | null;
  assetLabel?: string | null;
}

function format(ev: WebhookEvent): string {
  const tag =
    ev.type === "review_state" ? "✅ Review"
    : ev.type === "share_comment" ? "💬 External review"
    : ev.type === "job_error" ? "⚠️ Job failed"
    : "🔔 Studio";
  const lines = [`*${tag}* — ${ev.title}`];
  if (ev.body) lines.push(ev.body);
  return lines.join("\n");
}

/** Push an event if a webhook is configured and the type is notable. No-op otherwise. */
export async function emitWebhook(ev: WebhookEvent): Promise<void> {
  const url = WEBHOOK_URL();
  if (!url || !PUSH_TYPES.has(ev.type)) return;
  const msg = format(ev);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, content: msg }),
    });
  } catch (e) {
    console.warn(`⚠ webhook emit skipped: ${(e as Error).message}`);
  }
}

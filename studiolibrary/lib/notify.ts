/**
 * Notification fan-out. Runs off the asset_events spine: repo.ts:addEvent inserts
 * an event and calls fanOutEvent (fire-and-forget). One brain decides who gets
 * notified for each event type; inserts are dedupe-safe (the notifications_dedupe
 * unique index) so the same source event never double-notifies a recipient.
 *
 * All ids are canonical Neon user ids, resolved against the library users mirror.
 */
import { sql, query } from "./db/client";
import { parseMentions } from "./mentions";
import { emitWebhook } from "./webhooks";

export type NotificationType =
  | "mention" | "assignment" | "review_state" | "comment" | "share_comment" | "job_done" | "job_error";

export interface NotifyInput {
  recipientId: number;
  type: NotificationType;
  actorId?: number | null;
  actorName?: string | null;
  assetId?: number | null;
  targetType?: string | null;
  targetId?: number | null;
  title: string;
  body?: string | null;
  sourceEventId?: number | null;
}

/** Dedupe-safe insert (no-op on the source-event unique conflict). */
export async function notify(n: NotifyInput): Promise<void> {
  if (!n.recipientId) return;
  await sql`
    INSERT INTO notifications
      (recipient_id, type, actor_id, actor_name, asset_id, target_type, target_id, title, body, source_event_id)
    VALUES (${n.recipientId}, ${n.type}, ${n.actorId ?? null}, ${n.actorName ?? null}, ${n.assetId ?? null},
            ${n.targetType ?? null}, ${n.targetId ?? null}, ${n.title}, ${n.body ?? null}, ${n.sourceEventId ?? null})
    ON CONFLICT DO NOTHING
  `;
}

export async function notifyMany(ns: NotifyInput[]): Promise<void> {
  for (const n of ns) await notify(n);
}

// ── resolution helpers (against the library users mirror) ────────────────────
async function userByHandle(handle: string): Promise<{ id: number; name: string } | null> {
  const r = await sql<{ id: number; name: string }>`
    SELECT id, name FROM users WHERE lower(handle) = ${handle} AND active LIMIT 1`;
  return r[0] ?? null;
}
async function userIdByName(name: string | null | undefined): Promise<number | null> {
  if (!name) return null;
  const r = await sql<{ id: number }>`SELECT id FROM users WHERE name = ${name} LIMIT 1`;
  return r[0]?.id ?? null;
}
async function assetLabel(assetId: number): Promise<string> {
  const r = await sql<{ filename: string }>`SELECT filename FROM assets WHERE id = ${assetId}`;
  return r[0]?.filename ?? `asset #${assetId}`;
}
/** Everyone who has commented on or been assigned to an asset (real user ids). */
async function assetParticipants(assetId: number): Promise<number[]> {
  const r = await query<{ uid: number }>(
    `SELECT DISTINCT uid FROM (
       SELECT author_id      AS uid FROM annotations WHERE asset_id = $1 AND author_id      IS NOT NULL
       UNION
       SELECT assigned_to_id AS uid FROM annotations WHERE asset_id = $1 AND assigned_to_id IS NOT NULL
     ) p`,
    [assetId]
  );
  return r.map((x) => x.uid);
}

export interface FanEvent {
  id?: number | null;
  assetId: number;
  actorId?: number | null;
  actorName?: string | null;
  type: string;
  payload: Record<string, unknown>;
}

/** Decide + create notifications for one asset event. Never throws. */
export async function fanOutEvent(ev: FanEvent): Promise<void> {
  try {
    const actorId = ev.actorId ?? (await userIdByName(ev.actorName));
    const label = await assetLabel(ev.assetId);
    const base = {
      actorId, actorName: ev.actorName ?? null, assetId: ev.assetId,
      targetType: "asset" as const, targetId: ev.assetId, sourceEventId: ev.id ?? null,
    };

    if (ev.type === "comment" || ev.type === "marker") {
      const body = String(ev.payload.body ?? "");

      // 1) @mentions → notify each mentioned user.
      const handles = parseMentions(body);
      for (const handle of handles) {
        const u = await userByHandle(handle);
        if (u && u.id !== actorId) {
          await notify({ ...base, recipientId: u.id, type: "mention",
            title: `${ev.actorName ?? "Someone"} mentioned you on ${label}`, body });
        }
      }

      // 2) other thread participants (minus author + already-mentioned).
      const mentioned = new Set<number>();
      for (const h of handles) { const u = await userByHandle(h); if (u) mentioned.add(u.id); }
      const participants = (await assetParticipants(ev.assetId))
        .filter((id) => id !== actorId && !mentioned.has(id));
      for (const id of participants) {
        await notify({ ...base, recipientId: id, type: "comment",
          title: `${ev.actorName ?? "Someone"} commented on ${label}`, body });
      }
      return;
    }

    if (ev.type === "assignment") {
      const assigneeId = Number(ev.payload.assigned_to_id) ||
        (await userIdByName(typeof ev.payload.assigned_to === "string" ? ev.payload.assigned_to : null));
      if (assigneeId && assigneeId !== actorId) {
        await notify({ ...base, recipientId: assigneeId, type: "assignment",
          title: `${ev.actorName ?? "Someone"} assigned you ${label}`,
          body: typeof ev.payload.note === "string" ? ev.payload.note : null });
      }
      return;
    }

    if (ev.type === "state_change") {
      const to = String(ev.payload.to ?? "");
      const recipients = (await assetParticipants(ev.assetId)).filter((id) => id !== actorId);
      for (const id of recipients) {
        await notify({ ...base, recipientId: id, type: "review_state",
          title: `${label} → ${to.replace(/_/g, " ")}`,
          body: `${ev.actorName ?? "Someone"} changed the review state` });
      }
      // Push approvals/rejections/deliveries to Slack/Discord (best-effort).
      if (/approv|reject|deliver/.test(to)) {
        await emitWebhook({ type: "review_state", title: `${label} → ${to.replace(/_/g, " ")}`,
          body: `${ev.actorName ?? "Someone"} changed the review state` });
      }
      return;
    }

    if (ev.type === "share_comment") {
      const ownerId = Number(ev.payload.created_by_id) ||
        (await userIdByName(typeof ev.payload.created_by === "string" ? ev.payload.created_by : null));
      if (ownerId) {
        await notify({ ...base, recipientId: ownerId, type: "share_comment", actorId: null,
          actorName: typeof ev.payload.author === "string" ? ev.payload.author : "A reviewer",
          title: `New review comment on ${label}`,
          body: typeof ev.payload.body === "string" ? ev.payload.body : null });
      }
      await emitWebhook({ type: "share_comment", title: `New review comment on ${label}`,
        body: typeof ev.payload.body === "string" ? ev.payload.body : null });
      return;
    }
  } catch (e) {
    console.warn(`⚠ notification fan-out skipped: ${(e as Error).message}`);
  }
}

// ── Inbox queries (for the /api/notifications route) ─────────────────────────
export interface NotificationRow {
  id: number; recipient_id: number; type: string; actor_id: number | null; actor_name: string | null;
  asset_id: number | null; target_type: string | null; target_id: number | null;
  title: string; body: string | null; read_at: string | null; created_at: string;
}
export async function listNotifications(userId: number, limit = 30): Promise<NotificationRow[]> {
  return sql<NotificationRow>`
    SELECT * FROM notifications WHERE recipient_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}`;
}
export async function unreadCount(userId: number): Promise<number> {
  const r = await sql<{ n: string }>`
    SELECT count(*) n FROM notifications WHERE recipient_id = ${userId} AND read_at IS NULL`;
  return Number(r[0]?.n ?? 0);
}
export async function markRead(userId: number, ids: number[] | "all"): Promise<void> {
  if (ids === "all") {
    await sql`UPDATE notifications SET read_at = now() WHERE recipient_id = ${userId} AND read_at IS NULL`;
  } else if (ids.length) {
    await query(
      `UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND id = ANY($2) AND read_at IS NULL`,
      [userId, ids]
    );
  }
}

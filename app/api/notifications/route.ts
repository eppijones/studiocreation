import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users";
import { listNotifications, unreadCount, markRead } from "@/studiolibrary/lib/notify";

export const runtime = "nodejs";

/** GET — unread count + recent items for the current user. Empty in shared mode. */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ count: 0, items: [] });
  try {
    const [items, count] = await Promise.all([listNotifications(me.id), unreadCount(me.id)]);
    return NextResponse.json({ count, items });
  } catch {
    // Library DB unreachable — degrade quietly so the bell never errors.
    return NextResponse.json({ count: 0, items: [] });
  }
}

/** PATCH — mark notifications read ({ ids: number[] } or { all: true }). */
export async function PATCH(request: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  await markRead(me.id, body.all ? "all" : (Array.isArray(body.ids) ? body.ids.map(Number) : []));
  return NextResponse.json({ ok: true, count: await unreadCount(me.id) });
}

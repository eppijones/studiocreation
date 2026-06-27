import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users";
import { worklistFor, reviewVelocity } from "@/studiolibrary/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — the current user's worklist (assets with open tasks assigned to them)
 *  plus team review velocity. Empty in shared-password mode. */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ items: [], velocity: [], anon: true });
  try {
    const [items, velocity] = await Promise.all([worklistFor(me.id), reviewVelocity(7)]);
    return NextResponse.json({ items, velocity, me: { id: me.id, name: me.name } });
  } catch {
    return NextResponse.json({ items: [], velocity: [] });
  }
}

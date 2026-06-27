import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users";
import { heartbeat, viewers, clearPresence } from "@/studiolibrary/lib/presence";

export const runtime = "nodejs";

/** GET ?assetId= — live viewers of an asset. */
export async function GET(request: Request) {
  const assetId = Number(new URL(request.url).searchParams.get("assetId"));
  if (!Number.isInteger(assetId)) return NextResponse.json({ viewers: [] });
  try {
    return NextResponse.json({ viewers: await viewers(assetId) });
  } catch {
    return NextResponse.json({ viewers: [] });
  }
}

/** POST { assetId, leaving? } — heartbeat (or clear on leave). No-op in shared mode. */
export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: true, anon: true });
  const body = await request.json().catch(() => ({}));
  const assetId = Number(body.assetId);
  if (!Number.isInteger(assetId)) return NextResponse.json({ error: "bad assetId" }, { status: 400 });
  try {
    if (body.leaving) await clearPresence(assetId, me.id);
    else await heartbeat(assetId, me.id, me.name);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, degraded: true });
  }
}

import { NextResponse } from "next/server";
import {
  currentUser, getUserById, setUserActive, setUserRole, setUserPassword,
} from "@/lib/users";
import { parseRole } from "@/lib/auth";
import { safeMirrorUser } from "@/studiolibrary/lib/users-mirror";

export const runtime = "nodejs";

/** PATCH — change a user's role / active / password. Admin only. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  // Guard: an admin can't strip their own admin / deactivate themselves and get
  // locked out — keep at least the acting admin governing.
  const demotingSelf = typeof body.role === "string" && body.role !== "admin";
  const deactivatingSelf = body.active === false;
  if (id === me.id && (demotingSelf || deactivatingSelf)) {
    return NextResponse.json({ error: "You can't demote or deactivate yourself" }, { status: 400 });
  }

  if (typeof body.role === "string") await setUserRole(id, parseRole(body.role));
  if (typeof body.active === "boolean") await setUserActive(id, body.active);
  if (typeof body.password === "string" && body.password.length >= 6) {
    await setUserPassword(id, body.password);
  }

  const updated = await getUserById(id);
  if (updated) await safeMirrorUser(updated);
  return NextResponse.json({ user: updated });
}

/** DELETE — deactivate (we never hard-delete; assets/jobs reference the id). */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (id === me.id) return NextResponse.json({ error: "You can't deactivate yourself" }, { status: 400 });
  await setUserActive(id, false);
  const updated = await getUserById(id);
  if (updated) await safeMirrorUser(updated);
  return NextResponse.json({ ok: true, user: updated });
}

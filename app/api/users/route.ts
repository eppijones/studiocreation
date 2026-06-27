import { NextResponse } from "next/server";
import { createUser, listUsers, currentUser } from "@/lib/users";
import { parseRole } from "@/lib/auth";
import { safeMirrorUser } from "@/studiolibrary/lib/users-mirror";

export const runtime = "nodejs";

/** GET — the team directory. Any authenticated user (powers member pickers,
 *  mention autocomplete, assignment dropdowns). */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ users: await listUsers() });
}

/** POST — create a user. Admin only. */
export async function POST(request: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !name || password.length < 6) {
    return NextResponse.json({ error: "email, name, and a 6+ char password are required" }, { status: 400 });
  }

  try {
    const user = await createUser({ email, name, password, role: parseRole(body.role) });
    await safeMirrorUser(user);
    return NextResponse.json({ user });
  } catch (e) {
    const msg = (e as Error).message;
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

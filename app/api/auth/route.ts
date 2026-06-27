import { NextResponse } from "next/server";
import {
  createSessionToken, createUserSessionToken, parseRole,
  ROLE_COOKIE, SESSION_COOKIE, OPERATOR_COOKIE,
} from "@/lib/auth";
import { getUserByEmail, touchLogin } from "@/lib/users";
import { verifyPassword } from "@/lib/password";

// node:crypto (scrypt) + neon → must run on the Node runtime, never edge.
export const runtime = "nodejs";

// Cookie lifetime tracks the signed-token window (lib/auth SESSION_MAX_AGE_MS).
const SESSION_S = 60 * 60 * 24 * 30;
const COOKIE = { secure: true, sameSite: "lax" as const, maxAge: SESSION_S, path: "/" };

const userMode = () => !!process.env.SESSION_SECRET;

/** Login page probes this to know which form to render. */
export async function GET() {
  return NextResponse.json({ mode: userMode() ? "user" : "shared" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return userMode() ? loginUser(body) : loginShared(body);
}

/** Per-user login: email + password against the Neon users table. */
async function loginUser(body: Record<string, unknown>) {
  const secret = process.env.SESSION_SECRET!;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const token = await createUserSessionToken(
    { uid: user.id, role: user.role, tv: user.token_version }, secret
  );
  await touchLogin(user.id);

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, handle: user.handle, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, { ...COOKIE, httpOnly: true });
  // Keep the operator/role cookies so AppShell's readCookie() keeps working.
  response.cookies.set(OPERATOR_COOKIE, user.name, { ...COOKIE, httpOnly: false });
  response.cookies.set(ROLE_COOKIE, user.role, { ...COOKIE, httpOnly: false });
  return response;
}

/** Legacy shared-password login (SESSION_SECRET unset). */
async function loginShared(body: Record<string, unknown>) {
  const expected = process.env.STUDIO_PASSWORD;
  const password = typeof body.password === "string" ? body.password : "";
  if (!expected) {
    return NextResponse.json({ error: "STUDIO_PASSWORD is not configured" }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const operatorName = (typeof body.operator === "string" ? body.operator : "").trim().slice(0, 40) || "unknown";
  const roleName = parseRole(typeof body.role === "string" ? body.role : undefined);
  const token = await createSessionToken(expected);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, { ...COOKIE, httpOnly: true });
  response.cookies.set(OPERATOR_COOKIE, operatorName, { ...COOKIE, httpOnly: false });
  response.cookies.set(ROLE_COOKIE, roleName, { ...COOKIE, httpOnly: false });
  return response;
}

/** Logout — clear the session cookies. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, OPERATOR_COOKIE, ROLE_COOKIE]) {
    response.cookies.set(name, "", { ...COOKIE, maxAge: 0, httpOnly: name === SESSION_COOKIE });
  }
  return response;
}

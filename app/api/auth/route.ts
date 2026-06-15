import { NextResponse } from "next/server";
import {
  createSessionToken,
  parseRole,
  ROLE_COOKIE,
  SESSION_COOKIE,
  OPERATOR_COOKIE,
} from "@/lib/auth";

// Cookie lifetime tracks the signed-token window (lib/auth SESSION_MAX_AGE_MS).
const SESSION_S = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const { password, operator, role } = await request.json();
  const expected = process.env.STUDIO_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "STUDIO_PASSWORD is not configured" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const operatorName = (typeof operator === "string" ? operator : "").trim().slice(0, 40) || "unknown";
  const roleName = parseRole(typeof role === "string" ? role : undefined);
  const token = await createSessionToken(expected);

  const response = NextResponse.json({ ok: true });
  const cookie = { secure: true, sameSite: "lax" as const, maxAge: SESSION_S, path: "/" };
  response.cookies.set(SESSION_COOKIE, token, { ...cookie, httpOnly: true });
  response.cookies.set(OPERATOR_COOKIE, operatorName, { ...cookie, httpOnly: false });
  response.cookies.set(ROLE_COOKIE, roleName, { ...cookie, httpOnly: false });
  return response;
}

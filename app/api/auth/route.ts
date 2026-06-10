import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, OPERATOR_COOKIE } from "@/lib/auth";

const YEAR_S = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const { password, operator } = await request.json();
  const expected = process.env.STUDIO_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "STUDIO_PASSWORD is not configured" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const operatorName = (typeof operator === "string" ? operator : "").trim().slice(0, 40) || "unknown";
  const token = await createSessionToken(expected);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: YEAR_S,
    path: "/",
  });
  response.cookies.set(OPERATOR_COOKIE, operatorName, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    maxAge: YEAR_S,
    path: "/",
  });
  return response;
}

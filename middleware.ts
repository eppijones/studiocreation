import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// /api/reconcile does its own auth (studio session OR Vercel cron secret).
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks/fal", "/api/reconcile"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.next(); // unset = gate off (local dev before setup)

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

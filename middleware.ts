import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// /api/reconcile does its own auth (studio session OR Vercel cron secret).
// /api/showcase is intentionally public — it powers the pre-auth login wall and
// only exposes renders the studio curated with the `showcaser` tag.
// /library/share/* and /api/library/share-view/* are token-gated external
// review links — the token IS the credential, so no studio session is required.
const PUBLIC_PATHS = [
  "/login", "/api/auth", "/api/showcase", "/api/webhooks/fal", "/api/reconcile",
  "/library/share", "/api/library/share-view",
];

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
  // Skip Next internals and any static asset with an image extension — public
  // files like /roles/<id>.webp (role-tile art) must serve without the auth gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico)$).*)"],
};

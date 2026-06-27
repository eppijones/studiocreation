import { NextResponse, type NextRequest } from "next/server";
import {
  verifySessionToken, verifyUserSessionToken,
  SESSION_COOKIE, UID_HEADER, ROLE_HEADER,
} from "@/lib/auth";

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

  // Strip any client-supplied identity headers up front — only middleware may
  // set these, after verifying the session. Prevents x-studio-uid spoofing.
  const clean = new Headers(request.headers);
  clean.delete(UID_HEADER);
  clean.delete(ROLE_HEADER);
  const pass = () => NextResponse.next({ request: { headers: clean } });

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return pass();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;

  // Per-user mode (SESSION_SECRET set): verify the identity token at the edge
  // and forward the verified uid/role to node routes as headers, so they never
  // re-verify. The authoritative active/token_version check happens in node
  // routes via lib/users.currentUser().
  if (secret) {
    const claims = await verifyUserSessionToken(token, secret);
    if (claims) {
      clean.set(UID_HEADER, String(claims.uid));
      clean.set(ROLE_HEADER, claims.role);
      return NextResponse.next({ request: { headers: clean } });
    }
    return denied(request, pathname);
  }

  // Legacy shared-password mode (SESSION_SECRET unset). Unset STUDIO_PASSWORD too
  // = gate off (local dev before setup).
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return pass();
  if (await verifySessionToken(token, password)) return pass();
  return denied(request, pathname);
}

function denied(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Skip Next internals and any static asset with an image extension — public
  // files like /roles/<id>.webp (role-tile art) must serve without the auth gate.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico)$).*)"],
};

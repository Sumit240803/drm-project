import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

/**
 * Edge middleware. Two jobs:
 *   1. Block mobile / tablet devices entirely — this app is desktop-only
 *      (mobile web cannot block screen recording, so we don't serve it there).
 *   2. Guard `/watch` and `/api/vdo-otp` behind a valid session.
 */

// Matches phones and tablets. Windows / macOS / Linux desktop UAs do not match.
const MOBILE_UA =
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone|Mobile/i;

function isMobile(ua: string): boolean {
  return MOBILE_UA.test(ua);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") || "";

  // 1. Block mobile/tablet.
  if (isMobile(ua)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "This service is only available on desktop." },
        { status: 403 }
      );
    }
    if (pathname !== "/blocked") {
      const url = req.nextUrl.clone();
      url.pathname = "/blocked";
      url.search = "";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Desktop visitors shouldn't see the blocked page.
  if (pathname === "/blocked") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Session guard for protected routes.
  if (pathname === "/watch" || pathname === "/api/vdo-otp") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const claims = await verifySession(token);
    if (!claims) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

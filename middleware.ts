import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

/**
 * Edge middleware guard. Protects the `/watch` page and the `/api/vdo-otp`
 * route. Unauthenticated page requests redirect to `/`; unauthenticated API
 * requests get a 401.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);

  if (claims) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/watch", "/api/vdo-otp"],
};

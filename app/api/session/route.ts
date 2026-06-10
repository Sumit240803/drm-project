import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { isSessionActive } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Lightweight session heartbeat. Returns 200 while this is still the live
 * session for the key, 401 once it's been revoked (logged out, expired, or
 * superseded by a newer login on another device). The /watch page polls this
 * to kick a stale device without needing a reload. Does NOT mint an OTP, so
 * it's cheap and never touches the VdoCipher API.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims || !(await isSessionActive(claims))) {
    return NextResponse.json({ active: false }, { status: 401 });
  }
  return NextResponse.json({ active: true });
}

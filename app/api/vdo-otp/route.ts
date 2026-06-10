import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { isSessionActive, clientIp } from "@/lib/session";
import { getVdoOtp } from "@/lib/vdocipher";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 1. Verify the session JWT signature/expiry (also enforced by middleware).
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Authoritative revocation check against Redis: the key must still be
  // active and this must still be the live session for it.
  if (!(await isSessionActive(claims))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. email + videoId come from the verified token, never the request body.
  //    The IP is read from the request at playback time for the watermark.
  try {
    const ip = clientIp(req);
    const { otp, playbackInfo } = await getVdoOtp(claims.videoId, claims.email, ip);
    // Return the IP too so the page can show the viewer what's embedded in the
    // watermark (deterrent — they see their own identifying data on screen).
    return NextResponse.json({ otp, playbackInfo, ip });
  } catch {
    // Details already logged server-side in getVdoOtp.
    return NextResponse.json(
      { error: "Could not generate playback token" },
      { status: 502 }
    );
  }
}

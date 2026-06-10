import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";
import { getRedis, keyName } from "@/lib/redis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Revoke the server-side session so a copied cookie can't be replayed after
  // logout (the JWT itself stays cryptographically valid until its exp).
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  if (claims) {
    try {
      const redis = getRedis();
      // Only clear if this cookie owns the current session (avoid a stale
      // cookie revoking a newer login).
      const current = await redis.hget(keyName(claims.key), "sid");
      if (current && String(current) === claims.sid) {
        await redis.hset(keyName(claims.key), { sid: "" });
      }
    } catch {
      // Best-effort revocation; still clear the cookie below.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

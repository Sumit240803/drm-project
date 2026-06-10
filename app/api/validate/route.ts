import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRedis, keyName, type KeyRecord } from "@/lib/redis";
import { SESSION_COOKIE, signSession } from "@/lib/jwt";
import { rateLimitAllow, clientIp } from "@/lib/session";

export const runtime = "nodejs";

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

// Brute-force limits (fixed window). Generous for ~15 legit viewers, but makes
// guessing access keys infeasible.
const IP_LIMIT = 15; // attempts per window per IP
const KEY_LIMIT = 6; // attempts per window per access key
const RL_WINDOW_SECONDS = 600; // 10 minutes

export async function POST(req: NextRequest) {
  let body: { email?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";

  if (!email || !key) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Rate limit by IP and by attempted key before touching the record.
  const ip = clientIp(req);
  const [ipOk, keyOk] = await Promise.all([
    rateLimitAllow(`validate:ip:${ip}`, IP_LIMIT, RL_WINDOW_SECONDS),
    rateLimitAllow(`validate:key:${key}`, KEY_LIMIT, RL_WINDOW_SECONDS),
  ]);
  if (!ipOk || !keyOk) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  // 1. Look up the access key.
  const redis = getRedis();
  const rec = await redis.hgetall<Record<string, unknown>>(keyName(key));
  if (!rec || !rec.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. The key must be bound to this email.
  if (String(rec.email).trim().toLowerCase() !== email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoId = String(rec.videoId);
  const now = Date.now();

  let activatedAt = toNumberOrNull(rec.activatedAt);
  let expiresAt = toNumberOrNull(rec.expiresAt);

  if (activatedAt === null) {
    // 3. First successful use → activate now, expire in 5 hours.
    activatedAt = now;
    expiresAt = now + FIVE_HOURS_MS;
  } else if (expiresAt !== null && now > expiresAt) {
    // 4. Already activated and past expiry.
    return NextResponse.json({ error: "Expired" }, { status: 403 });
  }

  // Mint a fresh session id on every successful login. Persisting it both
  // records activation (first use) AND rotates the active session, so any
  // previously-issued cookie for this key is immediately revoked — one live
  // session per key, and a kill-switch for sharing.
  const sid = randomUUID();
  const effectiveExpiry = expiresAt ?? now + FIVE_HOURS_MS;
  await redis.hset(keyName(key), {
    activatedAt,
    expiresAt: effectiveExpiry,
    sid,
  } satisfies Partial<KeyRecord>);

  // 5. Sign a session JWT whose expiry matches the key's expiry.
  const jwt = await signSession({ email, videoId, key, sid }, effectiveExpiry);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(effectiveExpiry),
  });
  return res;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

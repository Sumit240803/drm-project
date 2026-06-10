import { getRedis, keyName } from "@/lib/redis";
import type { SessionClaims } from "@/lib/jwt";

/**
 * Authoritative, Redis-backed session validation. A JWT can be cryptographically
 * valid and unexpired yet still be revoked (logged out, or superseded by a newer
 * login on another device). This re-checks the live key record so a stolen or
 * duplicated cookie cannot unlock the video.
 *
 * Returns true only if: the key still exists, is bound to the same email, has
 * not passed its `expiresAt`, and the session id still matches.
 */
export async function isSessionActive(claims: SessionClaims): Promise<boolean> {
  const redis = getRedis();
  const rec = await redis.hgetall<Record<string, unknown>>(keyName(claims.key));
  if (!rec || !rec.email) return false;

  if (String(rec.email).trim().toLowerCase() !== claims.email) return false;

  const expiresAt = toNumberOrNull(rec.expiresAt);
  if (expiresAt !== null && Date.now() > expiresAt) return false;

  if (!rec.sid || String(rec.sid) !== claims.sid) return false;

  return true;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE. Returns true if the
 * request is allowed, false if the limit for this window has been exceeded.
 * Keeps dependencies minimal (no @upstash/ratelimit).
 */
export async function rateLimitAllow(
  id: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const redis = getRedis();
  const k = `rl:${id}`;
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.expire(k, windowSeconds);
  }
  return count <= limit;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

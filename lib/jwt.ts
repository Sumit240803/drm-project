import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Session token helpers built on `jose` so they run in the Edge runtime
 * (middleware) as well as in Node route handlers.
 */

export const SESSION_COOKIE = "session";

export interface SessionClaims extends JWTPayload {
  email: string;
  videoId: string;
  /** The access key this session was minted from (used for revocation lookup). */
  key: string;
  /** Session id — must match the `sid` stored on the key record, or the session is revoked. */
  sid: string;
}

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

/**
 * Sign a session JWT. `expiresAtMs` is an absolute epoch-ms timestamp; the
 * token's `exp` claim is derived from it so the JWT and the access key expire
 * together.
 */
export async function signSession(
  claims: { email: string; videoId: string; key: string; sid: string },
  expiresAtMs: number
): Promise<string> {
  const expSeconds = Math.floor(expiresAtMs / 1000);
  return new SignJWT({
    email: claims.email,
    videoId: claims.videoId,
    key: claims.key,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expSeconds)
    .sign(secret());
}

/**
 * Verify a session JWT's signature and expiry. Returns the claims, or null if
 * invalid/expired. NOTE: this only proves the token is authentic and unexpired
 * — it does NOT check revocation. Use `assertActiveSession` (Redis-backed) for
 * the authoritative check before unlocking the video.
 */
export async function verifySession(
  token: string | undefined | null
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.email !== "string" ||
      typeof payload.videoId !== "string" ||
      typeof payload.key !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

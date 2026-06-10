import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client, created lazily so build-time page-data
 * collection (which runs with placeholder env values) doesn't construct it.
 * Never import the client into a client component.
 */
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set");
    }
    client = new Redis({ url, token });
  }
  return client;
}

/** The Redis hash stored per access key under `key:<ACCESS_KEY>`. */
export interface KeyRecord {
  email: string;
  videoId: string;
  activatedAt: number | null;
  expiresAt: number | null;
  /**
   * The id of the currently-authorized session. Rotated on every successful
   * login (so only one device holds a live session at a time) and cleared on
   * logout. A JWT whose `sid` no longer matches this value is treated as
   * revoked, even though it is still cryptographically valid and unexpired.
   */
  sid: string | null;
}

export function keyName(accessKey: string): string {
  return `key:${accessKey}`;
}

/**
 * Seed script — inserts placeholder access-key records into Upstash Redis.
 *
 * Run with:  npm run seed      (uses tsx)
 *
 * SECURITY: access keys are now CRYPTOGRAPHICALLY RANDOM and high-entropy
 * (format `KEY-<24 hex chars>` ≈ 96 bits). Sequential keys like `KEY-0001`
 * were trivially guessable; combined with rate limiting on /api/validate this
 * makes online brute force infeasible.
 *
 * Re-running regenerates a fresh set of keys (the old ones stop working). Copy
 * the printed table somewhere safe — the keys are not recoverable afterwards.
 *
 * Edit VIDEO_ID / EMAILS below before running.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

// ---- EDIT ME ----------------------------------------------------------------
// The VdoCipher video ID that every seeded key unlocks.
const VIDEO_ID = "580bb43ebc746114f265d5e341fd493a";

// One entry per viewer. Use each viewer's REAL email so the on-screen watermark
// identifies exactly who recorded a leak. Add/remove lines to change the count.
// (Reusing one email across many keys weakens traceability — every leak then
// points at the same address.)
const EMAILS: string[] = [
  "goyalsumit651@gmail.com",
];
// -----------------------------------------------------------------------------

function keyName(accessKey: string): string {
  return `key:${accessKey}`;
}

function generateAccessKey(): string {
  // 12 random bytes → 24 hex chars (~96 bits of entropy).
  return `KEY-${randomBytes(12).toString("hex")}`;
}

async function main() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.error(
      "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. " +
        "Set them in .env.local before running the seed."
    );
    process.exit(1);
  }

  if (!VIDEO_ID) {
    console.error("VIDEO_ID is empty. Edit scripts/seed.ts.");
    process.exit(1);
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const rows: { accessKey: string; email: string }[] = [];

  for (const email of EMAILS) {
    const accessKey = generateAccessKey();
    rows.push({ accessKey, email });

    // Fresh, unactivated record. activatedAt / expiresAt / sid are omitted
    // (treated as null) until first successful validation.
    await redis.del(keyName(accessKey));
    await redis.hset(keyName(accessKey), {
      email,
      videoId: VIDEO_ID,
    });
  }

  console.log(`\nSeeded ${rows.length} access key(s).`);
  console.log(`videoId = ${VIDEO_ID}\n`);
  console.log("  #  | Access Key                | Email");
  console.log("-----+---------------------------+-----------------------------");
  rows.forEach((r, idx) => {
    console.log(
      `  ${String(idx + 1).padStart(2, " ")} | ${r.accessKey.padEnd(25)} | ${r.email}`
    );
  });
  console.log("\nStore these keys now — re-running the seed regenerates them.\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

import { ENTITLEMENT_BASELINE_LIMITS } from "@shared/entitlements";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type AiRateLimitSurface = "lesson" | "assistant" | "learning_draft";
export const MAX_REQUESTS_PER_MINUTE =
  ENTITLEMENT_BASELINE_LIMITS.aiRequestsPerMinute;
export const MAX_REQUESTS_PER_DAY =
  ENTITLEMENT_BASELINE_LIMITS.aiRequestsPerDay;

function utcDayKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

function rowFromExecuteResult(result: unknown) {
  const outer = Array.isArray(result) ? result[0] : result;
  const row = Array.isArray(outer) ? outer[0] : null;
  if (!row || typeof row !== "object") return null;
  const candidate = row as { minuteCount?: unknown; dayCount?: unknown };
  return typeof candidate.minuteCount === "number" &&
    typeof candidate.dayCount === "number"
    ? { minuteCount: candidate.minuteCount, dayCount: candidate.dayCount }
    : null;
}

/**
 * Atomically consumes a durable AI allowance. The unique `(openId, surface)` row
 * means all server instances and restarts share the same minute/day budget.
 */
export async function enforceAiRateLimit(
  openId: string,
  surface: AiRateLimitSurface,
  now = new Date()
) {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "Student OS AI is temporarily unavailable. Please try again shortly.",
    });
  }
  const minuteBucket = Math.floor(now.getTime() / 60_000);
  const dayKey = utcDayKey(now);
  await db.execute(sql`
    INSERT INTO ai_rate_limits (openId, surface, minuteBucket, minuteCount, dayKey, dayCount, updatedAt)
    VALUES (${openId}, ${surface}, ${minuteBucket}, 1, ${dayKey}, 1, ${now})
    ON DUPLICATE KEY UPDATE
      minuteCount = IF(minuteBucket = VALUES(minuteBucket), minuteCount + 1, 1),
      minuteBucket = VALUES(minuteBucket),
      dayCount = IF(dayKey = VALUES(dayKey), dayCount + 1, 1),
      dayKey = VALUES(dayKey),
      updatedAt = VALUES(updatedAt)
  `);
  const result = await db.execute(sql`
    SELECT minuteCount, dayCount
    FROM ai_rate_limits
    WHERE openId = ${openId} AND surface = ${surface}
    LIMIT 1
  `);
  const row = rowFromExecuteResult(result);
  if (!row) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Student OS could not confirm the AI request allowance. Please try again shortly.",
    });
  }
  if (
    row.minuteCount > MAX_REQUESTS_PER_MINUTE ||
    row.dayCount > MAX_REQUESTS_PER_DAY
  ) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "You have asked the Student OS tutor a lot of questions recently. Please take a short pause and try again.",
    });
  }
}

/** Retained for test compatibility; durable counters are reset through isolated test database mocks. */
export function resetAiRateLimitsForTests() {}

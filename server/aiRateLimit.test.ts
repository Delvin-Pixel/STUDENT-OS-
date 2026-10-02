import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import {
  enforceAiRateLimit,
  MAX_REQUESTS_PER_DAY,
  MAX_REQUESTS_PER_MINUTE,
} from "./aiRateLimit";
import { getDb } from "./db";

function durableDb(row: { minuteCount: number; dayCount: number }) {
  return {
    execute: vi
      .fn()
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([[row]]),
  };
}

describe("Student OS durable AI rate limits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically claims an account-and-surface allowance from durable storage", async () => {
    const db = durableDb({ minuteCount: 1, dayCount: 1 });
    vi.mocked(getDb).mockResolvedValue(db as never);
    await expect(
      enforceAiRateLimit("alice", "assistant", new Date("2026-08-22T12:00:00Z"))
    ).resolves.toBeUndefined();
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("blocks a durable over-limit result regardless of which instance made prior requests", async () => {
    vi.mocked(getDb).mockResolvedValue(
      durableDb({
        minuteCount: MAX_REQUESTS_PER_MINUTE + 1,
        dayCount: 1,
      }) as never
    );
    await expect(enforceAiRateLimit("amina", "lesson")).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("blocks an exhausted durable daily allowance", async () => {
    vi.mocked(getDb).mockResolvedValue(
      durableDb({ minuteCount: 1, dayCount: MAX_REQUESTS_PER_DAY + 1 }) as never
    );
    await expect(
      enforceAiRateLimit("amina", "learning_draft")
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("fails closed when durable storage is unavailable instead of falling back to an instance-local counter", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    await expect(
      enforceAiRateLimit("amina", "assistant")
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});

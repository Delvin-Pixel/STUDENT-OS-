import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./safeOperationalLog", () => ({ logOperationalFailure: vi.fn() }));

import { getDb } from "./db";
import {
  authorizeAccountCapability,
  getAccountEntitlements,
} from "./entitlements";

function selectDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select };
}

describe("server-authoritative entitlements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves an active Premium row from durable account storage", async () => {
    vi.mocked(getDb).mockResolvedValue(
      selectDb([
        {
          plan: "premium",
          status: "active",
          provider: "paystack",
          providerSubscriptionId: "sub_server_1",
          currentPeriodEnd: new Date("2026-10-27T00:00:00Z"),
          lastVerifiedAt: new Date("2026-09-27T00:00:00Z"),
          cancelAtPeriodEnd: false,
        },
      ]) as never
    );

    const result = await getAccountEntitlements(
      "student-1",
      new Date("2026-09-27T00:00:00Z")
    );
    expect(result.plan).toBe("premium");
    expect(result.authorityStatus).toBe("verified");
  });

  it("defaults a verified account with no subscription row to Free", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb([]) as never);
    const result = await getAccountEntitlements(
      "student-2",
      new Date("2026-09-27T00:00:00Z")
    );
    expect(result.plan).toBe("free");
    expect(result.reason).toBe("no_subscription");
    expect(result.authorityStatus).toBe("verified");
  });

  it("fails Premium closed if the entitlement store is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const result = await getAccountEntitlements(
      "student-3",
      new Date("2026-09-27T00:00:00Z")
    );
    expect(result.plan).toBe("free");
    expect(result.authorityStatus).toBe("unavailable");
    expect(result.reason).toBe("entitlement_store_unavailable");
  });

  it("authorizes capabilities only from the verified server entitlement snapshot", async () => {
    vi.mocked(getDb).mockResolvedValue(
      selectDb([
        {
          plan: "premium",
          status: "active",
          provider: "paystack",
          providerSubscriptionId: "sub_server_auth",
          currentPeriodEnd: new Date("2026-10-27T00:00:00Z"),
          lastVerifiedAt: new Date("2026-09-27T00:00:00Z"),
          cancelAtPeriodEnd: false,
        },
      ]) as never
    );

    const result = await authorizeAccountCapability(
      "student-4",
      "advanced_ai_coach",
      new Date("2026-09-27T00:00:00Z")
    );
    expect(result.allowed).toBe(true);
    expect(result.snapshot.plan).toBe("premium");
  });
});

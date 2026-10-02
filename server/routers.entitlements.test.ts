import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./entitlements", () => ({ getAccountEntitlements: vi.fn() }));

import type { TrpcContext } from "./_core/context";
import { getAccountEntitlements } from "./entitlements";
import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "account-7",
      email: "student@example.com",
      name: "Student",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      workspace: null,
      workspaceSchemaVersion: 4,
      workspaceRevision: 0,
      workspaceUpdatedAt: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("entitlements.me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("derives the plan from the authenticated account instead of client input", async () => {
    vi.mocked(getAccountEntitlements).mockResolvedValue({
      schemaVersion: 1,
      plan: "premium",
      subscriptionPlan: "premium",
      subscriptionStatus: "active",
      provider: "paystack",
      reason: "premium_active",
      authorityStatus: "verified",
      evaluatedAt: "2026-09-27T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      capabilities: {
        core_learning: true,
        core_transition: true,
        core_offline: true,
        ai_assistant: true,
        advanced_ai_coach: true,
        ai_study_material_generation: true,
        advanced_quiz_generation: true,
        advanced_mastery_analytics: true,
        advanced_adaptive_planning: true,
        advanced_reports: true,
        expanded_cloud_storage: true,
        premium_customization: true,
        early_access: true,
      },
      usageLimits: {
        aiRequestsPerMinute: 12,
        aiRequestsPerDay: 120,
        materialFilesPerAccount: 100,
        materialBytesPerAccount: 50_000_000,
        workspaceBytes: 4 * 1024 * 1024,
      },
    });

    const result = await appRouter.createCaller(context()).entitlements.me();
    expect(getAccountEntitlements).toHaveBeenCalledWith("account-7");
    expect(result.plan).toBe("premium");
  });
});

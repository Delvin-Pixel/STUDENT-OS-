import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./academicContextCandidates", () => ({
  proposeAcademicContextCandidate: vi.fn(),
  latestAcademicContextCandidate: vi.fn(),
  listAcademicContextCandidates: vi.fn(),
}));

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  latestAcademicContextCandidate,
  listAcademicContextCandidates,
  proposeAcademicContextCandidate,
} from "./academicContextCandidates";

const input = {
  expectedAccountId: "owner-one",
  requestKey: "retrykey1234567890",
  context: {
    countryCode: "GH" as const,
    educationLevel: "SHS" as const,
    enrollmentMode: "private_candidate" as const,
    curriculumId: "gh-wassce-physics",
    curriculumVersion: "2026",
  },
};

const saved = {
  schemaVersion: 1 as const,
  candidateId: "7c3d6360-b5bd-4f36-853a-b3174393a900",
  context: input.context,
  provenance: "learner_declared" as const,
  authorityStatus: "unverified" as const,
  academicPolicyApproved: false as const,
  verifiedMasteryEligible: false as const,
  createdAt: "2026-10-26T10:00:00.000Z",
};

function caller(openId: string | null, cron = false) {
  const ctx = {
    user: openId
      ? {
          id: 5,
          openId,
          email: null,
          name: null,
          loginMethod: null,
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          workspace: null,
          workspaceSchemaVersion: 4,
          workspaceRevision: 0,
          workspaceUpdatedAt: null,
          ...(cron ? { isCron: true } : {}),
        }
      : null,
    req: { protocol: "https", headers: {} },
    res: {},
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("B62.5 protected academic context ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects every operation for a visitor without a signed-in session", async () => {
    const guest = caller(null);
    await expect(guest.academicContexts.propose(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      guest.academicContexts.latest({ expectedAccountId: "owner-one" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      guest.academicContexts.versions({ expectedAccountId: "owner-one" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(proposeAcademicContextCandidate).not.toHaveBeenCalled();
    expect(latestAcademicContextCandidate).not.toHaveBeenCalled();
    expect(listAcademicContextCandidates).not.toHaveBeenCalled();
  });

  it("rejects stale Account A requests from Account B before calling storage", async () => {
    const accountB = caller("owner-two");
    await expect(
      accountB.academicContexts.propose(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      accountB.academicContexts.latest({ expectedAccountId: "owner-one" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      accountB.academicContexts.versions({ expectedAccountId: "owner-one" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(proposeAcademicContextCandidate).not.toHaveBeenCalled();
    expect(latestAcademicContextCandidate).not.toHaveBeenCalled();
    expect(listAcademicContextCandidates).not.toHaveBeenCalled();
  });

  it("rejects scheduled cron identities for learner profile changes and reads", async () => {
    const cron = caller("cron_task", true);
    await expect(
      cron.academicContexts.propose({
        ...input,
        expectedAccountId: "cron_task",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      cron.academicContexts.latest({ expectedAccountId: "cron_task" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(proposeAcademicContextCandidate).not.toHaveBeenCalled();
  });

  it("passes only the authenticated owner to the persistence service", async () => {
    vi.mocked(proposeAcademicContextCandidate).mockResolvedValue(saved);
    const result = await caller("owner-one").academicContexts.propose(input);
    expect(result).toEqual(saved);
    expect(proposeAcademicContextCandidate).toHaveBeenCalledWith(
      "owner-one",
      "retrykey1234567890",
      input.context
    );
    expect(JSON.stringify(result)).not.toContain("owner-one");
  });

  it("reads the authenticated owner's newest version and bounded history", async () => {
    vi.mocked(latestAcademicContextCandidate).mockResolvedValue(saved);
    vi.mocked(listAcademicContextCandidates).mockResolvedValue([saved]);
    const owner = caller("owner-one");
    expect(
      await owner.academicContexts.latest({ expectedAccountId: "owner-one" })
    ).toEqual(saved);
    expect(
      await owner.academicContexts.versions({ expectedAccountId: "owner-one" })
    ).toEqual([saved]);
    expect(latestAcademicContextCandidate).toHaveBeenCalledWith("owner-one");
    expect(listAcademicContextCandidates).toHaveBeenCalledWith("owner-one");
  });

  it.each([
    { authorityStatus: "approved" },
    { policyBundleId: "fake-policy" },
    { verifiedMasteryEligible: true },
    { openId: "other-owner" },
  ])(
    "rejects forged curriculum authority at the API input: %o",
    async extra => {
      const forged = {
        ...input,
        context: { ...input.context, ...extra },
      };
      await expect(
        caller("owner-one").academicContexts.propose(forged)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(proposeAcademicContextCandidate).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid tertiary context rather than silently inferring programme", async () => {
    await expect(
      caller("owner-one").academicContexts.propose({
        ...input,
        context: {
          ...input.context,
          educationLevel: "TERTIARY",
        },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(proposeAcademicContextCandidate).not.toHaveBeenCalled();
  });
});

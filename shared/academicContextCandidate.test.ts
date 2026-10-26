import { describe, expect, it } from "vitest";
import {
  AcademicContextCandidateFieldsSchema,
  AcademicContextCandidateProposalSchema,
  AcademicContextCandidateResponseSchema,
  toAdvisoryAcademicProjection,
} from "./academicContextCandidate";

const context = {
  countryCode: "GH" as const,
  educationLevel: "SHS" as const,
  enrollmentMode: "private_candidate" as const,
  curriculumId: "wassce-physics",
  curriculumVersion: "2026",
  academicYear: "2026",
};

const request = {
  expectedAccountId: "signed-in-learner",
  requestKey: "nonce0123456789abcdefgh",
  context,
};

function response() {
  return AcademicContextCandidateResponseSchema.parse({
    schemaVersion: 1,
    candidateId: "a76f5b7a-0bf8-4933-b4a3-8462603f937b",
    context,
    provenance: "learner_declared",
    authorityStatus: "unverified",
    academicPolicyApproved: false,
    verifiedMasteryEligible: false,
    createdAt: "2026-10-26T10:00:00.000Z",
  });
}

describe("B62.5 learner-declared academic context contracts", () => {
  it.each(["JHS", "SHS", "TERTIARY"] as const)(
    "supports %s with explicit, level-specific boundaries",
    level => {
      const input = {
        ...context,
        educationLevel: level,
        ...(level === "TERTIARY" ? { programId: "bsc-it" } : {}),
      };
      expect(AcademicContextCandidateFieldsSchema.safeParse(input).success)
        .toBe(true);
    }
  );

  it("requires programme for tertiary and institution for institutional mode", () => {
    expect(AcademicContextCandidateFieldsSchema.safeParse({
      ...context,
      educationLevel: "TERTIARY",
    }).success).toBe(false);
    expect(AcademicContextCandidateFieldsSchema.safeParse({
      ...context,
      enrollmentMode: "institutional",
    }).success).toBe(false);
    expect(AcademicContextCandidateFieldsSchema.safeParse({
      ...context,
      enrollmentMode: "institutional",
      institutionId: "school-1",
    }).success).toBe(true);
  });

  it.each([
    { authorityStatus: "approved" },
    { academicPolicyApproved: true },
    { verifiedMasteryEligible: true },
    { policyBundleId: "official-claim" },
    { openId: "forged-owner" },
    { learnerId: "other-learner" },
  ])("rejects injected authority and ownership claims: %o", extra => {
    expect(AcademicContextCandidateProposalSchema.safeParse({
      ...request,
      context: { ...context, ...extra },
    }).success).toBe(false);
  });

  it("rejects non-Ghana country, unknown levels and malformed retry keys", () => {
    expect(AcademicContextCandidateProposalSchema.safeParse({
      ...request,
      context: { ...context, countryCode: "US" },
    }).success).toBe(false);
    expect(AcademicContextCandidateProposalSchema.safeParse({
      ...request,
      context: { ...context, educationLevel: "PRIMARY" },
    }).success).toBe(false);
    expect(AcademicContextCandidateProposalSchema.safeParse({
      ...request,
      requestKey: "short",
    }).success).toBe(false);
    expect(AcademicContextCandidateProposalSchema.safeParse({
      ...request,
      requestKey: "x".repeat(129),
    }).success).toBe(false);
  });

  it("does not permit override of advisory provenance or verified mastery", () => {
    const valid = response();
    expect(AcademicContextCandidateResponseSchema.safeParse({
      ...valid,
      authorityStatus: "approved",
    }).success).toBe(false);
    expect(AcademicContextCandidateResponseSchema.safeParse({
      ...valid,
      verifiedMasteryEligible: true,
    }).success).toBe(false);
    expect(AcademicContextCandidateResponseSchema.safeParse({
      ...valid,
      ownerOpenId: "exposed-owner",
    }).success).toBe(false);
  });

  it("produces a data-minimized projection for advisory AI only", () => {
    const projected = toAdvisoryAcademicProjection(response());
    expect(projected).toMatchObject({
      schemaVersion: 1,
      educationLevel: "SHS",
      curriculumId: "wassce-physics",
      provenance: "learner_declared",
      academicPolicyApproved: false,
      verifiedMasteryEligible: false,
    });
    expect(projected).not.toHaveProperty("expectedAccountId");
    expect(projected).not.toHaveProperty("createdAt");
    expect(projected).not.toHaveProperty("academicYear");
    expect(projected).not.toHaveProperty("sourceVerified");
  });
});

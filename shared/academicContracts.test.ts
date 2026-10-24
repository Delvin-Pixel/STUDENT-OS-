import { describe, expect, it } from "vitest";
import {
  AcademicContextSchema,
  classifyLegacyEducationLevel,
} from "./academicContext";
import {
  AcademicPolicyBundleSchema,
  isCompatiblePolicy,
} from "./academicGovernance";
import {
  EvidenceDecisionSchema,
  MasteryDecisionSchema,
  canUseEvidenceForVerifiedMastery,
} from "./academicEvidence";

const context = {
  id: "ctx",
  learnerId: "learner",
  countryCode: "GH",
  educationLevel: "JHS",
  enrollmentMode: "remedial",
  curriculumId: "curr",
  curriculumVersion: "1",
  policyBundleId: "bundle",
  status: "active",
};

const policy = {
  id: "bundle",
  version: "1.0.0",
  countryCode: "GH",
  educationLevel: "JHS",
  curriculumId: "curr",
  curriculumVersion: "1",
  status: "published",
  authorityId: "authority",
  sourceReferences: ["source"],
  approvedBy: "reviewer",
  approvedAt: "2026-10-01T00:00:00Z",
  publishedAt: "2026-10-02T00:00:00Z",
};

const evidence = {
  id: "d1",
  academicContextId: "ctx",
  evidenceId: "e1",
  policyBundleId: "bundle",
  status: "accepted",
  independence: "verified",
  sourceVerified: true,
  reasonCodes: ["reviewed"],
  recordedAt: "2026-10-03T00:00:00Z",
};

describe("B62.1 shared academic contracts", () => {
  it("supports JHS, SHS and tertiary with level-specific requirements", () => {
    expect(AcademicContextSchema.safeParse(context).success).toBe(true);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        educationLevel: "SHS",
      }).success
    ).toBe(true);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        educationLevel: "TERTIARY",
      }).success
    ).toBe(false);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        educationLevel: "TERTIARY",
        programId: "IT",
      }).success
    ).toBe(true);
  });

  it("models private candidates without making them a new education level", () => {
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        educationLevel: "SHS",
        enrollmentMode: "private_candidate",
      }).success
    ).toBe(true);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        educationLevel: "REMEDIAL",
      }).success
    ).toBe(false);
  });

  it("requires institutions for institutional enrollment", () => {
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        enrollmentMode: "institutional",
      }).success
    ).toBe(false);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        enrollmentMode: "institutional",
        institutionId: "school",
      }).success
    ).toBe(true);
  });

  it("does not invent a level or curriculum authority from legacy data", () => {
    expect(classifyLegacyEducationLevel("Other")).toBe(null);
    expect(classifyLegacyEducationLevel("Lower Secondary")).toBe("JHS");
    expect(classifyLegacyEducationLevel("Sixth Form / College")).toBe(null);
    expect(
      AcademicContextSchema.safeParse({
        ...context,
        curriculumVersion: "",
      }).success
    ).toBe(false);
  });

  it("rejects incompatible or unapproved policy bundles", () => {
    const parsed = AcademicPolicyBundleSchema.parse(policy);
    expect(isCompatiblePolicy(context, parsed)).toBe(true);
    expect(
      isCompatiblePolicy(
        { ...context, curriculumVersion: "2" },
        parsed
      )
    ).toBe(false);
    expect(
      AcademicPolicyBundleSchema.safeParse({
        ...policy,
        approvedBy: undefined,
      }).success
    ).toBe(false);
    expect(
      isCompatiblePolicy(
        context,
        AcademicPolicyBundleSchema.parse({
          ...policy,
          status: "withdrawn",
        })
      )
    ).toBe(false);
  });

  it("requires independently verified source evidence for eligibility", () => {
    const parsed = EvidenceDecisionSchema.parse(evidence);
    expect(canUseEvidenceForVerifiedMastery(parsed)).toBe(true);
    expect(
      canUseEvidenceForVerifiedMastery({
        ...parsed,
        independence: "assisted",
      })
    ).toBe(false);
    expect(
      canUseEvidenceForVerifiedMastery({
        ...parsed,
        sourceVerified: false,
      })
    ).toBe(false);
    expect(
      canUseEvidenceForVerifiedMastery({
        ...parsed,
        status: "held",
      })
    ).toBe(false);
  });

  it("does not allow verified mastery with no evidence references", () => {
    const decision = {
      id: "m1",
      academicContextId: "ctx",
      outcomeId: "outcome",
      policyBundleId: "bundle",
      state: "verified",
      evidenceDecisionIds: [],
      engineVersion: "1",
      decidedAt: "2026-10-03T00:00:00Z",
    };
    expect(MasteryDecisionSchema.safeParse(decision).success).toBe(false);
    expect(
      MasteryDecisionSchema.safeParse({
        ...decision,
        evidenceDecisionIds: ["d1"],
      }).success
    ).toBe(true);
  });

  it("rejects noncanonical client-supplied policy and evidence fields", () => {
    expect(
      AcademicPolicyBundleSchema.safeParse({
        ...policy,
        userClaimsOfficial: true,
      }).success
    ).toBe(false);
    expect(
      EvidenceDecisionSchema.safeParse({
        ...evidence,
        modelAwardedMastery: true,
      }).success
    ).toBe(false);
  });
});

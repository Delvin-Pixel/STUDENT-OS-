import { z } from "zod";
import {
  EducationLevelSchema,
  EnrollmentModeSchema,
} from "./academicContext";

/**
 * Onboarding data from the authenticated learner. This is never an approved
 * academic policy or an authoritative source of mastery evidence.
 */
export const AcademicContextCandidateFieldsSchema = z
  .object({
    countryCode: z.literal("GH"),
    educationLevel: EducationLevelSchema,
    enrollmentMode: EnrollmentModeSchema,
    institutionId: z.string().trim().min(1).max(160).optional(),
    curriculumId: z.string().trim().min(1).max(160),
    curriculumVersion: z.string().trim().min(1).max(64),
    academicYear: z.string().trim().min(1).max(80).optional(),
    yearOrLevel: z.string().trim().min(1).max(80).optional(),
    termOrSemester: z.string().trim().min(1).max(80).optional(),
    programId: z.string().trim().min(1).max(160).optional(),
    qualificationId: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.educationLevel === "TERTIARY" && !data.programId)
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "A tertiary programme identifier is required",
      });
    if (data.enrollmentMode === "institutional" && !data.institutionId)
      ctx.addIssue({
        code: "custom",
        path: ["institutionId"],
        message: "Institutional study requires an institution identifier",
      });
  });

export type AcademicContextCandidateFields = z.infer<
  typeof AcademicContextCandidateFieldsSchema
>;

export const AcademicContextCandidateProposalSchema = z
  .object({
    /** Originating-account guard; NEVER used as the database owner. */
    expectedAccountId: z.string().min(1).max(64),
    /** Bounded idempotency key for retries and duplicate request detection. */
    requestKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    context: AcademicContextCandidateFieldsSchema,
  })
  .strict();

export const AcademicContextCandidateResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateId: z.uuid(),
    context: AcademicContextCandidateFieldsSchema,
    provenance: z.literal("learner_declared"),
    authorityStatus: z.literal("unverified"),
    academicPolicyApproved: z.literal(false),
    verifiedMasteryEligible: z.literal(false),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type AcademicContextCandidateResponse = z.infer<
  typeof AcademicContextCandidateResponseSchema
>;

/**
 * Safe advisory projection for a future NEXA integration. It cannot be
 * used as an AcademicContextSchema (which requires a server-approved policy).
 */
export const AcademicContextAdvisoryProjectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    candidateId: z.uuid(),
    countryCode: z.literal("GH"),
    educationLevel: EducationLevelSchema,
    enrollmentMode: EnrollmentModeSchema,
    curriculumId: z.string().min(1).max(160),
    curriculumVersion: z.string().min(1).max(64),
    programId: z.string().min(1).max(160).optional(),
    provenance: z.literal("learner_declared"),
    academicPolicyApproved: z.literal(false),
    verifiedMasteryEligible: z.literal(false),
  })
  .strict();

export function toAdvisoryAcademicProjection(
  candidate: AcademicContextCandidateResponse
): z.infer<typeof AcademicContextAdvisoryProjectionSchema> {
  const parsed = AcademicContextCandidateResponseSchema.parse(candidate);
  return AcademicContextAdvisoryProjectionSchema.parse({
    schemaVersion: 1,
    candidateId: parsed.candidateId,
    countryCode: parsed.context.countryCode,
    educationLevel: parsed.context.educationLevel,
    enrollmentMode: parsed.context.enrollmentMode,
    curriculumId: parsed.context.curriculumId,
    curriculumVersion: parsed.context.curriculumVersion,
    ...(parsed.context.programId
      ? { programId: parsed.context.programId }
      : {}),
    provenance: "learner_declared",
    academicPolicyApproved: false,
    verifiedMasteryEligible: false,
  });
}

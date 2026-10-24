import { z } from "zod";

export const EducationLevelSchema = z.enum(["JHS", "SHS", "TERTIARY"]);
export type EducationLevel = z.infer<typeof EducationLevelSchema>;

export const EnrollmentModeSchema = z.enum([
  "institutional",
  "remedial",
  "private_candidate",
  "transfer",
]);

export const AcademicContextSchema = z
  .object({
    id: z.string().min(1).max(160),
    learnerId: z.string().min(1).max(160),
    countryCode: z.literal("GH"),
    educationLevel: EducationLevelSchema,
    enrollmentMode: EnrollmentModeSchema,
    institutionId: z.string().min(1).max(160).optional(),
    curriculumId: z.string().min(1).max(160),
    curriculumVersion: z.string().min(1).max(64),
    policyBundleId: z.string().min(1).max(160),
    academicYear: z.string().max(80).optional(),
    yearOrLevel: z.string().max(80).optional(),
    termOrSemester: z.string().max(80).optional(),
    programId: z.string().max(160).optional(),
    qualificationId: z.string().max(160).optional(),
    status: z.enum(["active", "historical", "pending_review"]),
  })
  .strict()
  .superRefine((context, ctx) => {
    if (context.educationLevel === "TERTIARY" && !context.programId) {
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "Tertiary context requires an explicit program identifier",
      });
    }
    if (context.enrollmentMode === "institutional" && !context.institutionId) {
      ctx.addIssue({
        code: "custom",
        path: ["institutionId"],
        message: "Institutional enrollment requires an institution",
      });
    }
  });

export type AcademicContext = z.infer<typeof AcademicContextSchema>;

/** Historic profile labels are not proof of enrolment or approved curriculum. */
export function classifyLegacyEducationLevel(
  value: string
): EducationLevel | null {
  switch (value.trim().toLowerCase()) {
    case "jhs":
    case "lower secondary":
      return "JHS";
    case "shs":
    case "secondary":
      return "SHS";
    case "tertiary":
      return "TERTIARY";
    default:
      return null;
  }
}

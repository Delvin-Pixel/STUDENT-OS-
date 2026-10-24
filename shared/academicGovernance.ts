import { z } from "zod";
import { EducationLevelSchema } from "./academicContext";

export const AcademicPolicyBundleSchema = z
  .object({
    id: z.string().min(1).max(160),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    countryCode: z.literal("GH"),
    educationLevel: EducationLevelSchema,
    curriculumId: z.string().min(1),
    curriculumVersion: z.string().min(1),
    status: z.enum([
      "draft",
      "under_review",
      "approved",
      "published",
      "superseded",
      "withdrawn",
    ]),
    authorityId: z.string().min(1),
    sourceReferences: z.array(z.string().min(1)).min(1),
    approvedBy: z.string().min(1).optional(),
    approvedAt: z.iso.datetime().optional(),
    publishedAt: z.iso.datetime().optional(),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    if (
      ["approved", "published", "superseded"].includes(bundle.status) &&
      (!bundle.approvedBy || !bundle.approvedAt)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Approved policy requires approval provenance",
      });
    }
    if (bundle.status === "published" && !bundle.publishedAt) {
      ctx.addIssue({
        code: "custom",
        message: "Published policy requires publication time",
      });
    }
  });

export type AcademicPolicyBundle = z.infer<typeof AcademicPolicyBundleSchema>;

/**
 * Compatibility is a version and state check, not proof that the policy has
 * been authenticated or approved by a genuine academic authority.
 */
export function isCompatiblePolicy(
  context: {
    countryCode: string;
    educationLevel: string;
    curriculumId: string;
    curriculumVersion: string;
    policyBundleId: string;
  },
  policy: AcademicPolicyBundle
): boolean {
  return (
    policy.status === "published" &&
    context.countryCode === policy.countryCode &&
    context.educationLevel === policy.educationLevel &&
    context.curriculumId === policy.curriculumId &&
    context.curriculumVersion === policy.curriculumVersion &&
    context.policyBundleId === policy.id
  );
}

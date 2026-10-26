import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  academicContextCandidates,
  type AcademicContextCandidate,
} from "../drizzle/schema";
import {
  AcademicContextCandidateFieldsSchema,
  AcademicContextCandidateResponseSchema,
  type AcademicContextCandidateFields,
  type AcademicContextCandidateResponse,
} from "../shared/academicContextCandidate";
import { getDb } from "./db";

function requireOwner(openId: string) {
  if (!openId || openId.length > 64)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A valid signed-in account is required.",
    });
}

function candidateFieldsFromRow(
  row: AcademicContextCandidate
): AcademicContextCandidateFields {
  return AcademicContextCandidateFieldsSchema.parse({
    countryCode: row.countryCode,
    educationLevel: row.educationLevel,
    enrollmentMode: row.enrollmentMode,
    ...(row.institutionId ? { institutionId: row.institutionId } : {}),
    curriculumId: row.curriculumId,
    curriculumVersion: row.curriculumVersion,
    ...(row.academicYear ? { academicYear: row.academicYear } : {}),
    ...(row.yearOrLevel ? { yearOrLevel: row.yearOrLevel } : {}),
    ...(row.termOrSemester ? { termOrSemester: row.termOrSemester } : {}),
    ...(row.programId ? { programId: row.programId } : {}),
    ...(row.qualificationId
      ? { qualificationId: row.qualificationId }
      : {}),
  });
}

function toPublicCandidate(
  row: AcademicContextCandidate
): AcademicContextCandidateResponse {
  // Intentionally exclude openId, internal primary key and retry key.
  return AcademicContextCandidateResponseSchema.parse({
    schemaVersion: 1,
    candidateId: row.candidateId,
    context: candidateFieldsFromRow(row),
    provenance: row.dataOrigin,
    authorityStatus: row.authorityStatus,
    academicPolicyApproved: false,
    verifiedMasteryEligible: false,
    createdAt: row.createdAt.toISOString(),
  });
}

function sameCandidateFields(
  row: AcademicContextCandidate,
  input: AcademicContextCandidateFields
): boolean {
  // Both values have been normalized and validated by the same schema.
  const existing = candidateFieldsFromRow(row);
  return (
    Object.keys({ ...existing, ...input }).every(
      key =>
        existing[key as keyof AcademicContextCandidateFields] ===
        input[key as keyof AcademicContextCandidateFields]
    )
  );
}

async function ownedRequest(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  openId: string,
  requestKey: string
) {
  return (
    await db
      .select()
      .from(academicContextCandidates)
      .where(
        and(
          eq(academicContextCandidates.openId, openId),
          eq(academicContextCandidates.requestKey, requestKey)
        )
      )
      .limit(1)
  )[0];
}

function assertMatchingRetry(
  row: AcademicContextCandidate,
  requested: AcademicContextCandidateFields
): AcademicContextCandidateResponse {
  if (!sameCandidateFields(row, requested))
    throw new TRPCError({
      code: "CONFLICT",
      message: "The retry key belongs to a different academic context.",
    });
  return toPublicCandidate(row);
}

/**
 * Append an account-owned, learner-declared context candidate.
 *
 * A client cannot set owner identity, policy approval, evidentiary status, or
 * official source provenance. Idempotent retries do not silently mutate an
 * earlier version. Distinct changes create a new immutable row.
 */
export async function proposeAcademicContextCandidate(
  openId: string,
  requestKey: string,
  draft: AcademicContextCandidateFields
): Promise<AcademicContextCandidateResponse> {
  requireOwner(openId);
  const input = AcademicContextCandidateFieldsSchema.parse(draft);
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Academic context storage is not available.",
    });

  const previous = await ownedRequest(db, openId, requestKey);
  if (previous) return assertMatchingRetry(previous, input);

  try {
    await db.insert(academicContextCandidates).values({
      openId,
      candidateId: randomUUID(),
      requestKey,
      countryCode: "GH",
      educationLevel: input.educationLevel,
      enrollmentMode: input.enrollmentMode,
      institutionId: input.institutionId ?? null,
      curriculumId: input.curriculumId,
      curriculumVersion: input.curriculumVersion,
      academicYear: input.academicYear ?? null,
      yearOrLevel: input.yearOrLevel ?? null,
      termOrSemester: input.termOrSemester ?? null,
      programId: input.programId ?? null,
      qualificationId: input.qualificationId ?? null,
      dataOrigin: "learner_declared",
      authorityStatus: "unverified",
    });
  } catch (error) {
    // Handles the parallel-retry race without changing the winner. A unique
    // request key with different content is an explicit conflict, not last-write.
    const raced = await ownedRequest(db, openId, requestKey);
    if (raced) return assertMatchingRetry(raced, input);
    throw error;
  }

  const inserted = await ownedRequest(db, openId, requestKey);
  if (!inserted)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Academic context persistence could not be confirmed.",
    });
  return assertMatchingRetry(inserted, input);
}

/** Most recent inserted version for the authenticated owner only. */
export async function latestAcademicContextCandidate(
  openId: string
): Promise<AcademicContextCandidateResponse | null> {
  requireOwner(openId);
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Academic context storage is not available.",
    });
  const row = (
    await db
      .select()
      .from(academicContextCandidates)
      .where(eq(academicContextCandidates.openId, openId))
      .orderBy(desc(academicContextCandidates.id))
      .limit(1)
  )[0];
  return row ? toPublicCandidate(row) : null;
}

/** A bounded audit-friendly view of immutable candidate versions. */
export async function listAcademicContextCandidates(
  openId: string
): Promise<AcademicContextCandidateResponse[]> {
  requireOwner(openId);
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Academic context storage is not available.",
    });
  const rows = await db
    .select()
    .from(academicContextCandidates)
    .where(eq(academicContextCandidates.openId, openId))
    .orderBy(desc(academicContextCandidates.id))
    .limit(10);
  return rows.map(toPublicCandidate);
}

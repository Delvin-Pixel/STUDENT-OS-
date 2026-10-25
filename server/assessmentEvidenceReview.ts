import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  assessmentQuestions,
  assessmentResponses,
  assessmentSessions,
  assessmentSubmissions,
  type AssessmentQuestion,
  type AssessmentResponse,
  type AssessmentSession,
  type AssessmentSubmission,
} from "../drizzle/schema";
import {
  AssessmentEvidenceReviewSchema,
  type AssessmentEvidenceReview,
} from "../shared/assessmentEvidenceReview";
import { getDb } from "./db";

type SessionFacts = Pick<
  AssessmentSession,
  | "id"
  | "openId"
  | "sourceQuizId"
  | "topicId"
  | "status"
  | "questionSetHash"
  | "questionCount"
  | "submittedAt"
  | "finalScore"
  | "correctCount"
>;
type SubmissionFacts = Pick<
  AssessmentSubmission,
  | "sessionId"
  | "openId"
  | "score"
  | "correctCount"
  | "questionCount"
  | "finalizedAt"
>;
type QuestionFacts = Pick<
  AssessmentQuestion,
  "ordinal" | "prompt" | "options" | "correctOptionIndex" | "explanation"
>;
type ResponseFacts = Pick<
  AssessmentResponse,
  "questionOrdinal" | "selectedOptionIndex"
>;

export type AssessmentReviewFacts = {
  requestingOpenId: string;
  session: SessionFacts;
  submission: SubmissionFacts | null;
  questions: QuestionFacts[];
  responses: ResponseFacts[];
};
type Reason = AssessmentEvidenceReview["reasonCodes"][number];

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Deterministic integrity audit of server-retrieved facts. Client-supplied
 * objects must NEVER be used as an authoritative source for this function.
 * Even a sound server snapshot stays limited advisory evidence because the
 * source quiz is learner-controlled and test independence is unknown.
 */
export function evaluateAssessmentEvidenceReview(
  facts: AssessmentReviewFacts
): AssessmentEvidenceReview {
  const { session, submission, questions, responses, requestingOpenId } = facts;
  const reasons: Reason[] = [];
  const reviewBase = {
    schemaVersion: 1 as const,
    assessmentSessionId: session.id,
    sourceQuizId: session.sourceQuizId,
    topicId: session.topicId,
    assessmentOrigin: "learner_workspace_quiz" as const,
    academicContextId: null,
    policyBundleId: null,
    independence: "unknown" as const,
    sourceApproval: "unverified" as const,
    authoritativeMasteryEligible: false as const,
  };

  if (
    !requestingOpenId ||
    session.openId !== requestingOpenId ||
    (submission && submission.openId !== requestingOpenId)
  ) {
    reasons.push("owner_mismatch");
  }

  if (session.status !== "submitted") {
    if (reasons.length === 0) {
      return AssessmentEvidenceReviewSchema.parse({
        ...reviewBase,
        disposition: "pending_submission",
        snapshotIntegrity: "not_finalized",
        score: null,
        finalizedAt: null,
        reasonCodes: ["assessment_not_submitted"],
      });
    }
    reasons.push("assessment_not_submitted");
  } else if (!submission || submission.sessionId !== session.id) {
    reasons.push("missing_final_submission");
  }

  const expectedCount = session.questionCount;
  const questionsValid =
    expectedCount === 50 &&
    questions.length === expectedCount &&
    questions.every(
      (q, index) =>
        q.ordinal === index &&
        typeof q.prompt === "string" &&
        q.prompt.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.length <= 6 &&
        q.options.every(option => typeof option === "string") &&
        Number.isInteger(q.correctOptionIndex) &&
        q.correctOptionIndex >= 0 &&
        q.correctOptionIndex < q.options.length &&
        typeof q.explanation === "string"
    );
  if (!questionsValid) reasons.push("question_set_invalid");

  if (questionsValid) {
    const snapshot = questions.map(question => ({
      ordinal: question.ordinal,
      prompt: question.prompt,
      options: question.options,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation,
    }));
    const digest = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");
    if (digest !== session.questionSetHash)
      reasons.push("question_snapshot_mismatch");
  }

  const responseMap = new Map<number, number>();
  let responsesValid = responses.length === expectedCount && questionsValid;
  for (const response of responses) {
    if (
      !Number.isInteger(response.questionOrdinal) ||
      response.questionOrdinal < 0 ||
      response.questionOrdinal >= expectedCount ||
      responseMap.has(response.questionOrdinal) ||
      !Number.isInteger(response.selectedOptionIndex) ||
      !questions[response.questionOrdinal] ||
      response.selectedOptionIndex < 0 ||
      response.selectedOptionIndex >=
        questions[response.questionOrdinal].options.length
    ) {
      responsesValid = false;
    }
    responseMap.set(response.questionOrdinal, response.selectedOptionIndex);
  }
  if (!responsesValid || responseMap.size !== expectedCount)
    reasons.push("response_set_invalid");

  if (submission) {
    const correctCount =
      questionsValid && responsesValid
        ? questions.filter(
            question =>
              responseMap.get(question.ordinal) === question.correctOptionIndex
          ).length
        : null;
    const expectedScore =
      correctCount === null
        ? null
        : Math.round((correctCount / expectedCount) * 100);
    if (
      submission.questionCount !== expectedCount ||
      !Number.isInteger(submission.score) ||
      submission.score < 0 ||
      submission.score > 100 ||
      !Number.isInteger(submission.correctCount) ||
      submission.correctCount < 0 ||
      submission.correctCount > expectedCount ||
      session.finalScore !== submission.score ||
      session.correctCount !== submission.correctCount ||
      (correctCount !== null &&
        (correctCount !== submission.correctCount ||
          expectedScore !== submission.score))
    ) {
      reasons.push("score_inconsistent");
    }
  }

  if (
    !validDate(session.submittedAt) ||
    !submission ||
    !validDate(submission.finalizedAt) ||
    session.submittedAt.getTime() !== submission.finalizedAt.getTime()
  ) {
    reasons.push("finalization_invalid");
  }

  if (reasons.length > 0)
    return AssessmentEvidenceReviewSchema.parse({
      ...reviewBase,
      disposition: "held_integrity",
      snapshotIntegrity: "held",
      score: null,
      finalizedAt: null,
      reasonCodes: reasons,
    });

  // Integrity and server finalization alone cannot attest curriculum authority,
  // independent assessment conditions, or eligibility for verified mastery.
  return AssessmentEvidenceReviewSchema.parse({
    ...reviewBase,
    disposition: "limited_advisory",
    snapshotIntegrity: "intact",
    score: submission!.score,
    finalizedAt: submission!.finalizedAt.toISOString(),
    reasonCodes: [
      "academic_context_not_bound",
      "source_not_academically_reviewed",
      "independence_unverified",
    ],
  });
}

/**
 * Authenticated, account-isolated read from existing B58 assessment tables.
 * No writes, score changes, workspace sync, or academic decisions.
 */
export async function readAssessmentEvidenceReview(
  openId: string,
  sessionId: number
): Promise<AssessmentEvidenceReview> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Assessment evidence review requires the account database.",
    });
  const session = (
    await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.id, sessionId),
          eq(assessmentSessions.openId, openId)
        )
      )
      .limit(1)
  )[0];
  if (!session)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Assessment session not found in your account.",
    });

  const [questions, responses, submissions] = await Promise.all([
    db
      .select()
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.sessionId, session.id))
      .orderBy(asc(assessmentQuestions.ordinal)),
    db
      .select()
      .from(assessmentResponses)
      .where(eq(assessmentResponses.sessionId, session.id)),
    db
      .select()
      .from(assessmentSubmissions)
      .where(
        and(
          eq(assessmentSubmissions.sessionId, session.id),
          eq(assessmentSubmissions.openId, openId)
        )
      )
      .limit(1),
  ]);

  return evaluateAssessmentEvidenceReview({
    requestingOpenId: openId,
    session,
    submission: submissions[0] ?? null,
    questions,
    responses,
  });
}

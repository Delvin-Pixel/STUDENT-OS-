import { validateStudyState } from "@shared/workspaceSchema";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  assessmentQuestions,
  assessmentResponses,
  assessmentSessions,
  assessmentSubmissions,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getWorkspace } from "./workspace";

const id = z.string().min(1).max(160);
const key = z.string().min(16).max(128);

export const assessmentStartInput = z.object({
  quizId: id,
  clientStartKey: key,
});
export const assessmentReadInput = z.object({
  sessionId: z.number().int().positive(),
});
export const assessmentSaveResponseInput = z.object({
  sessionId: z.number().int().positive(),
  questionOrdinal: z.number().int().min(0).max(99),
  selectedOptionIndex: z.number().int().min(0).max(5),
});
export const assessmentSubmitInput = z.object({
  sessionId: z.number().int().positive(),
  clientSubmitKey: key,
});

type SnapshotQuestion = {
  ordinal: number;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
};
type LearnerQuestion = Omit<
  SnapshotQuestion,
  "correctOptionIndex" | "explanation"
>;
export type AssessmentGrade = {
  grade: "A+ / A" | "A- / B+" | "B / C+" | "C / D" | "D / E" | "F";
  performance: string;
};
type AssessmentResult = {
  sessionId: number;
  score: number;
  correctCount: number;
  questionCount: number;
  finalizedAt: Date;
} & AssessmentGrade;

export function assessmentGradeForScore(score: number): AssessmentGrade {
  if (!Number.isInteger(score) || score < 0 || score > 100)
    throw new RangeError(
      "Assessment score must be an integer from 0 through 100."
    );
  if (score >= 90)
    return { grade: "A+ / A", performance: "Excellent — mastery demonstrated" };
  if (score >= 80)
    return {
      grade: "A- / B+",
      performance: "Very good — strong understanding",
    };
  if (score >= 70)
    return {
      grade: "B / C+",
      performance: "Good — solid understanding with minor gaps",
    };
  if (score >= 60)
    return {
      grade: "C / D",
      performance: "Satisfactory — some important gaps",
    };
  if (score >= 50)
    return { grade: "D / E", performance: "Weak pass — needs review" };
  if (score >= 40)
    return { grade: "F", performance: "Poor — major improvement needed" };
  if (score >= 30)
    return { grade: "F", performance: "Very poor — serious gaps" };
  if (score >= 20)
    return {
      grade: "F",
      performance: "Critical — foundational support needed",
    };
  if (score >= 10)
    return { grade: "F", performance: "Very critical — topic not understood" };
  return { grade: "F", performance: "No meaningful understanding shown" };
}

function unavailable(): never {
  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message:
      "Trusted assessments are not available right now. Your local practice quizzes remain available.",
  });
}

function questionSetHash(questions: SnapshotQuestion[]) {
  return createHash("sha256").update(JSON.stringify(questions)).digest("hex");
}

async function ownedQuizSnapshot(openId: string, quizId: string) {
  const record = await getWorkspace(openId);
  if (!record.workspace)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This quiz is not available in your account workspace.",
    });
  let raw: unknown;
  try {
    raw = JSON.parse(record.workspace);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The account workspace could not be read safely.",
    });
  }
  const parsed = validateStudyState(raw);
  if (!parsed.success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The account workspace could not be validated safely.",
    });
  const quiz = parsed.data.quizzes.find(candidate => candidate.id === quizId);
  if (!quiz)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This quiz is not available in your account workspace.",
    });
  if (quiz.questions.length !== 50) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Trusted assessments require an exact 50-question validated assessment. Use the AI assessment generator or choose Practice for a shorter quiz.",
    });
  }
  const questions = quiz.questions.map((question, ordinal) => ({
    ordinal,
    prompt: question.prompt,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    explanation: question.explanation,
  }));
  return { quiz, questions };
}

async function ownedSession(openId: string, sessionId: number) {
  const db = await getDb();
  if (!db) unavailable();
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
      message: "This assessment session is not available in your account.",
    });
  return { db, session };
}

function learnerQuestion(question: SnapshotQuestion): LearnerQuestion {
  return {
    ordinal: question.ordinal,
    prompt: question.prompt,
    options: question.options,
  };
}

async function readQuestions(sessionId: number): Promise<SnapshotQuestion[]> {
  const db = await getDb();
  if (!db) unavailable();
  const rows = await db
    .select()
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.sessionId, sessionId))
    .orderBy(asc(assessmentQuestions.ordinal));
  return rows.map(row => ({
    ordinal: row.ordinal,
    prompt: row.prompt,
    options: row.options,
    correctOptionIndex: row.correctOptionIndex,
    explanation: row.explanation,
  }));
}

export async function startAssessment(
  openId: string,
  input: z.infer<typeof assessmentStartInput>
) {
  const db = await getDb();
  if (!db) unavailable();
  const existing = (
    await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.openId, openId),
          eq(assessmentSessions.clientStartKey, input.clientStartKey)
        )
      )
      .limit(1)
  )[0];
  if (existing) {
    if (existing.sourceQuizId !== input.quizId) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This assessment start key is already bound to a different quiz.",
      });
    }
    const questions = await readQuestions(existing.id);
    return {
      sessionId: existing.id,
      status: existing.status,
      expiresAt: existing.expiresAt,
      questions: questions.map(learnerQuestion),
    };
  }
  const { quiz, questions } = await ownedQuizSnapshot(openId, input.quizId);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1_000);
  let sessionId: number;
  try {
    const inserted = await db
      .insert(assessmentSessions)
      .values({
        openId,
        sourceQuizId: quiz.id,
        ...(quiz.topicId ? { topicId: quiz.topicId } : {}),
        questionSetHash: questionSetHash(questions),
        questionCount: questions.length,
        clientStartKey: input.clientStartKey,
        expiresAt,
      })
      .$returningId();
    sessionId = Number(inserted[0]?.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) unavailable();
    await db
      .insert(assessmentQuestions)
      .values(questions.map(question => ({ sessionId, ...question })));
  } catch {
    const retried = (
      await db
        .select()
        .from(assessmentSessions)
        .where(
          and(
            eq(assessmentSessions.openId, openId),
            eq(assessmentSessions.clientStartKey, input.clientStartKey)
          )
        )
        .limit(1)
    )[0];
    if (!retried)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "The assessment could not be started safely. Please try again.",
      });
    const questions = await readQuestions(retried.id);
    return {
      sessionId: retried.id,
      status: retried.status,
      expiresAt: retried.expiresAt,
      questions: questions.map(learnerQuestion),
    };
  }
  return {
    sessionId,
    status: "in_progress" as const,
    expiresAt,
    questions: questions.map(learnerQuestion),
  };
}

export async function readAssessment(
  openId: string,
  input: z.infer<typeof assessmentReadInput>
) {
  const { session } = await ownedSession(openId, input.sessionId);
  const questions = await readQuestions(session.id);
  const db = await getDb();
  if (!db) unavailable();
  const responses = await db
    .select({
      questionOrdinal: assessmentResponses.questionOrdinal,
      selectedOptionIndex: assessmentResponses.selectedOptionIndex,
    })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.sessionId, session.id));
  const result =
    session.status === "submitted"
      ? (
          await db
            .select()
            .from(assessmentSubmissions)
            .where(eq(assessmentSubmissions.sessionId, session.id))
            .limit(1)
        )[0]
      : undefined;
  return {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    questions: questions.map(learnerQuestion),
    responses,
    ...(result
      ? {
          result: {
            score: result.score,
            correctCount: result.correctCount,
            questionCount: result.questionCount,
            finalizedAt: result.finalizedAt,
            ...assessmentGradeForScore(result.score),
          },
        }
      : {}),
  };
}

export async function saveAssessmentResponse(
  openId: string,
  input: z.infer<typeof assessmentSaveResponseInput>
) {
  const { db, session } = await ownedSession(openId, input.sessionId);
  if (session.status !== "in_progress" || session.expiresAt <= new Date())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This assessment is no longer accepting answers.",
    });
  const question = (
    await db
      .select()
      .from(assessmentQuestions)
      .where(
        and(
          eq(assessmentQuestions.sessionId, session.id),
          eq(assessmentQuestions.ordinal, input.questionOrdinal)
        )
      )
      .limit(1)
  )[0];
  if (!question || input.selectedOptionIndex >= question.options.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Choose one of this assessment question’s current answer options.",
    });
  await db
    .insert(assessmentResponses)
    .values({
      sessionId: session.id,
      questionOrdinal: input.questionOrdinal,
      selectedOptionIndex: input.selectedOptionIndex,
    })
    .onDuplicateKeyUpdate({
      set: {
        selectedOptionIndex: input.selectedOptionIndex,
        updatedAt: new Date(),
      },
    });
  return { saved: true } as const;
}

export async function submitAssessment(
  openId: string,
  input: z.infer<typeof assessmentSubmitInput>
): Promise<AssessmentResult> {
  const { db, session } = await ownedSession(openId, input.sessionId);
  const existing = (
    await db
      .select()
      .from(assessmentSubmissions)
      .where(
        and(
          eq(assessmentSubmissions.openId, openId),
          eq(assessmentSubmissions.clientSubmitKey, input.clientSubmitKey)
        )
      )
      .limit(1)
  )[0];
  if (existing) {
    if (existing.sessionId !== input.sessionId) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This submission key is already bound to a different assessment session.",
      });
    }
    return {
      sessionId: existing.sessionId,
      score: existing.score,
      correctCount: existing.correctCount,
      questionCount: existing.questionCount,
      finalizedAt: existing.finalizedAt,
      ...assessmentGradeForScore(existing.score),
    };
  }
  if (session.status !== "in_progress" || session.expiresAt <= new Date())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This assessment can no longer be submitted.",
    });
  const questions = await readQuestions(session.id);
  const responses = await db
    .select()
    .from(assessmentResponses)
    .where(eq(assessmentResponses.sessionId, session.id));
  if (responses.length !== questions.length)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Answer every assessment question before submitting.",
    });
  const selected = new Map(
    responses.map(response => [
      response.questionOrdinal,
      response.selectedOptionIndex,
    ])
  );
  const correctCount = questions.filter(
    question => selected.get(question.ordinal) === question.correctOptionIndex
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const finalizedAt = new Date();
  try {
    await db.transaction(async tx => {
      await tx.insert(assessmentSubmissions).values({
        openId,
        sessionId: session.id,
        clientSubmitKey: input.clientSubmitKey,
        score,
        correctCount,
        questionCount: questions.length,
        finalizedAt,
      });
      await tx
        .update(assessmentSessions)
        .set({
          status: "submitted",
          submittedAt: finalizedAt,
          finalScore: score,
          correctCount,
        })
        .where(
          and(
            eq(assessmentSessions.id, session.id),
            eq(assessmentSessions.openId, openId),
            eq(assessmentSessions.status, "in_progress")
          )
        );
      const finalized = (
        await tx
          .select({ id: assessmentSessions.id })
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.id, session.id),
              eq(assessmentSessions.openId, openId),
              eq(assessmentSessions.status, "submitted")
            )
          )
          .limit(1)
      )[0];
      if (!finalized)
        throw new Error("Assessment session finalization was not confirmed.");
    });
  } catch {
    const retried = (
      await db
        .select()
        .from(assessmentSubmissions)
        .where(
          and(
            eq(assessmentSubmissions.openId, openId),
            eq(assessmentSubmissions.clientSubmitKey, input.clientSubmitKey)
          )
        )
        .limit(1)
    )[0];
    if (retried && retried.sessionId === input.sessionId)
      return {
        sessionId: retried.sessionId,
        score: retried.score,
        correctCount: retried.correctCount,
        questionCount: retried.questionCount,
        finalizedAt: retried.finalizedAt,
        ...assessmentGradeForScore(retried.score),
      };
    if (retried)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "This submission key is already bound to a different assessment session.",
      });
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "The assessment result could not be finalized safely. Please retry with the same submission key.",
    });
  }
  return {
    sessionId: session.id,
    score,
    correctCount,
    questionCount: questions.length,
    finalizedAt,
    ...assessmentGradeForScore(score),
  };
}

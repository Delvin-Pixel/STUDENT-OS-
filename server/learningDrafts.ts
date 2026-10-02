import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, isTextGenerationModel, listLLMModels } from "./_core/llm";
import { validateQuizEducationalQuality } from "./aiEducationalQuality";
import {
  learningStatePrompt,
  validateLearningStateClaims,
  type LearningStateSnapshot,
} from "./aiLearningState";
import {
  validateQuizSemanticIntegrity,
  validateScheduleSemanticIntegrity,
} from "./aiSemanticIntegrity";
import { parseStructuredOutput } from "./aiStructuredOutput";
import { logOperationalFailure } from "./safeOperationalLog";

export const learningDraftRequestSchema = z.object({
  subject: z.string().trim().min(2).max(80),
  topic: z.string().trim().min(2).max(140),
  educationLevel: z.string().trim().min(2).max(80),
  /** Optional, learner-chosen context. The client must never send the entire workspace. */
  learningContext: z.string().trim().max(1_200).optional(),
  learningState: z.unknown().optional(),
  assessmentFocus: z
    .object({
      mode: z.enum(["diagnostic", "remediation_verification", "fresh_recheck"]),
      focusConcepts: z
        .array(z.string().trim().min(1).max(140))
        .max(6)
        .default([]),
      weakConcepts: z
        .array(z.string().trim().min(1).max(140))
        .max(6)
        .default([]),
      recentMisses: z
        .array(z.string().trim().min(1).max(140))
        .max(8)
        .default([]),
      excludeQuestionPrompts: z
        .array(z.string().trim().min(1).max(1_200))
        .max(20)
        .default([]),
      difficultyGuidance: z.enum(["mixed", "foundation", "application"]),
      rationale: z.string().trim().min(1).max(300),
    })
    .optional(),
});

export const quizDraftSchema = z.object({
  title: z.string().min(1).max(120),
  instructions: z.string().min(1).max(400),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1).max(1_200),
        options: z.array(z.string().min(1).max(300)).min(2).max(4),
        correctOptionIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(1_200),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        subtopic: z.string().trim().max(140).optional(),
      })
    )
    .length(50),
});

export type QuizDraft = z.infer<typeof quizDraftSchema>;
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const localTime = z.string().regex(/^\d{2}:\d{2}$/);
const schedulePriority = z.enum(["high", "medium", "low"]);

export const scheduleDraftRequestSchema = z.object({
  today: localDate,
  horizonEnd: localDate,
  availableMinutesPerDay: z.number().int().min(30).max(360),
  learningState: z.unknown().optional(),
  deadlines: z
    .array(
      z.object({
        kind: z.enum(["task", "exam"]),
        title: z.string().trim().min(1).max(120),
        subject: z.string().trim().min(1).max(80),
        dueDate: localDate,
        priority: schedulePriority,
        estimatedMinutes: z.number().int().min(15).max(360),
      })
    )
    .min(1)
    .max(20),
  existingSessions: z
    .array(
      z.object({
        date: localDate,
        startTime: localTime,
        duration: z.number().int().min(10).max(360),
      })
    )
    .max(60),
  recurringBlocks: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        startTime: localTime,
        endTime: localTime,
      })
    )
    .max(60),
  preferredStudyWindow: z
    .object({ startTime: localTime, endTime: localTime })
    .refine(window => window.endTime > window.startTime, {
      message: "Preferred study window must end after it starts.",
    }),
});

export const scheduleDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().min(1).max(400),
  sessions: z
    .array(
      z.object({
        date: localDate,
        startTime: localTime,
        duration: z.number().int().min(15).max(180),
        subject: z.string().trim().min(1).max(80),
        topic: z.string().trim().min(1).max(140),
        priority: schedulePriority,
        reason: z.string().trim().min(1).max(280),
        deadlineTitle: z.string().trim().min(1).max(120),
      })
    )
    .min(1)
    .max(21),
});

export type ScheduleDraft = z.infer<typeof scheduleDraftSchema>;
let selectedModel: string | null | undefined;

async function selectDraftModel() {
  if (selectedModel) return selectedModel;
  try {
    const { data } = await listLLMModels();
    const model =
      data.find(
        model => isTextGenerationModel(model) && model.id === "gpt-5-mini"
      )?.id ??
      data.find(
        model =>
          isTextGenerationModel(model) && model.id.startsWith("gpt-5-mini")
      )?.id ??
      data.find(
        model =>
          isTextGenerationModel(model) && model.id.startsWith("claude-haiku")
      )?.id ??
      data.find(isTextGenerationModel)?.id ??
      null;
    if (model) selectedModel = model;
    return model;
  } catch {
    // Do not memoize a transient catalog failure: a later learner request can recover.
    return null;
  }
}

export const quizDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    instructions: { type: "string" },
    questions: {
      type: "array",
      minItems: 50,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" },
          },
          correctOptionIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          subtopic: { type: "string" },
        },
        required: ["prompt", "options", "correctOptionIndex", "explanation"],
      },
    },
  },
  required: ["title", "instructions", "questions"],
} as const;

export const scheduleDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    instructions: { type: "string" },
    sessions: {
      type: "array",
      minItems: 1,
      maxItems: 21,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          startTime: { type: "string" },
          duration: { type: "integer", minimum: 15, maximum: 180 },
          subject: { type: "string" },
          topic: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          deadlineTitle: { type: "string" },
        },
        required: [
          "date",
          "startTime",
          "duration",
          "subject",
          "topic",
          "priority",
          "reason",
          "deadlineTitle",
        ],
      },
    },
  },
  required: ["title", "instructions", "sessions"],
} as const;

function minutesAt(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
function overlaps(
  start: number,
  duration: number,
  otherStart: number,
  otherDuration: number
) {
  return start < otherStart + otherDuration && otherStart < start + duration;
}
function weekday(date: string) {
  return (new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

function validateScheduleDraft(
  draft: ScheduleDraft,
  input: z.infer<typeof scheduleDraftRequestSchema>
) {
  const minutesByDate = new Map<string, number>();
  for (const existing of input.existingSessions) {
    minutesByDate.set(
      existing.date,
      (minutesByDate.get(existing.date) ?? 0) + existing.duration
    );
  }
  for (const session of draft.sessions) {
    if (session.date < input.today || session.date > input.horizonEnd)
      throw new Error("Outside planning window");
    const start = minutesAt(session.startTime);
    if (
      start < 360 ||
      start + session.duration > 1_320 ||
      start < minutesAt(input.preferredStudyWindow.startTime) ||
      start + session.duration > minutesAt(input.preferredStudyWindow.endTime)
    )
      throw new Error("Outside preferred study window");
    const used = (minutesByDate.get(session.date) ?? 0) + session.duration;
    if (used > input.availableMinutesPerDay)
      throw new Error(
        "Daily capacity exceeded when active sessions are included"
      );
    minutesByDate.set(session.date, used);
    if (
      input.existingSessions.some(
        existing =>
          existing.date === session.date &&
          overlaps(
            start,
            session.duration,
            minutesAt(existing.startTime),
            existing.duration
          )
      )
    )
      throw new Error("Existing session overlap");
    if (
      input.recurringBlocks.some(
        block =>
          block.day === weekday(session.date) &&
          overlaps(
            start,
            session.duration,
            minutesAt(block.startTime),
            minutesAt(block.endTime) - minutesAt(block.startTime)
          )
      )
    )
      throw new Error("Timetable block overlap");
  }
  for (let index = 0; index < draft.sessions.length; index += 1) {
    const current = draft.sessions[index];
    if (
      draft.sessions
        .slice(index + 1)
        .some(
          other =>
            other.date === current.date &&
            overlaps(
              minutesAt(current.startTime),
              current.duration,
              minutesAt(other.startTime),
              other.duration
            )
        )
    )
      throw new Error("Proposed session overlap");
  }
}

export async function generateQuizDraft(
  input: z.infer<typeof learningDraftRequestSchema>,
  signal?: AbortSignal
): Promise<QuizDraft> {
  const model = await selectDraftModel();
  try {
    const response = await invokeLLM({
      ...(model ? { model } : {}),
      maxCompletionTokens: 12_000,
      signal,
      ...(model?.startsWith("gpt-5")
        ? { reasoning: { effort: "minimal" } }
        : {}),
      messages: [
        {
          role: "system",
          content:
            "You create careful, age-appropriate practice quiz drafts. Return JSON only. Use the supplied subject, topic, education level, and optional learner-selected context; do not invent course-specific facts. Make every question answerable, include short explanations, use exactly 50 distinct multiple-choice questions, and vary difficulty from recall to application. When focused assessment guidance is supplied, prioritize the named weak concepts and recent miss patterns. Every question must be fresh: never reuse or lightly paraphrase an excluded prior prompt. The assessment must test understanding through varied scenarios, not repeated memorization of the same item.",
        },
        {
          role: "user",
          content: `Create a reviewable practice quiz draft.\nSubject: ${input.subject}\nTopic: ${input.topic}\nEducation level: ${input.educationLevel}\nLearner-selected context: ${input.learningContext || "None provided"}
Current learning-state context: ${input.learningState ? learningStatePrompt(input.learningState as LearningStateSnapshot) : "No verified learning state provided."}
Focused assessment guidance: ${input.assessmentFocus ? JSON.stringify(input.assessmentFocus) : "None provided."}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "student_os_quiz_draft",
          strict: true,
          schema: quizDraftJsonSchema,
        },
      },
    });
    const raw = response.choices[0]?.message?.content;
    const text = typeof raw === "string" ? raw : "";
    const draft = parseStructuredOutput(text, quizDraftSchema, "Quiz draft");
    validateQuizSemanticIntegrity(draft, input);
    validateQuizEducationalQuality(draft);
    if (input.learningState) {
      const learningState = input.learningState as LearningStateSnapshot;
      validateLearningStateClaims(
        JSON.stringify(draft),
        learningState,
        "Quiz draft"
      );
    }
    const prompts = new Set<string>();
    for (const question of draft.questions) {
      if (question.correctOptionIndex >= question.options.length)
        throw new Error("The draft included an invalid answer index.");
      const normalizedOptions = question.options.map(option =>
        option.trim().toLowerCase()
      );
      if (new Set(normalizedOptions).size !== normalizedOptions.length)
        throw new Error("The draft included duplicate answer choices.");
      const promptKey = question.prompt
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (prompts.has(promptKey))
        throw new Error("The draft included duplicate questions.");
      prompts.add(promptKey);
    }
    if (input.assessmentFocus?.excludeQuestionPrompts?.length) {
      const excluded = new Set(
        input.assessmentFocus.excludeQuestionPrompts.map(prompt =>
          prompt.trim().toLowerCase().replace(/\s+/g, " ")
        )
      );
      const exactReuse = draft.questions.some(question =>
        excluded.has(question.prompt.trim().toLowerCase().replace(/\s+/g, " "))
      );
      if (exactReuse)
        throw new Error(
          "The focused assessment reused a prior question prompt."
        );
    }
    if (input.assessmentFocus) {
      const focusTerms = [
        ...input.assessmentFocus.focusConcepts,
        ...input.assessmentFocus.weakConcepts,
      ].map(value => value.toLowerCase());
      const taggedFocusCount = draft.questions.filter(
        question =>
          question.subtopic &&
          focusTerms.some(term =>
            question.subtopic!.toLowerCase().includes(term)
          )
      ).length;
      if (
        focusTerms.length &&
        taggedFocusCount < Math.min(10, draft.questions.length)
      ) {
        throw new Error(
          "The focused assessment did not allocate enough questions to the requested weak concepts."
        );
      }
    }
    return draft;
  } catch (error) {
    if (signal?.aborted) throw error;
    logOperationalFailure("Learning drafts", "Quiz generation failed", error);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "Student OS could not generate a quiz draft right now. Your existing study data has not changed; please try again shortly.",
    });
  }
}

/** Produces a proposal only. Canonical StudySession records are created only after browser-side learner review. */
export async function generateScheduleDraft(
  input: z.infer<typeof scheduleDraftRequestSchema>,
  signal?: AbortSignal
): Promise<ScheduleDraft> {
  const model = await selectDraftModel();
  try {
    const response = await invokeLLM({
      ...(model ? { model } : {}),
      maxCompletionTokens: 2_000,
      signal,
      ...(model?.startsWith("gpt-5")
        ? { reasoning: { effort: "minimal" } }
        : {}),
      messages: [
        {
          role: "system",
          content:
            "Create a realistic, bounded study schedule proposal. Return JSON only. Use supplied deadlines, daily capacity, active study sessions, recurring unavailable blocks, and the learner's preferred study window. Schedule 1–21 sessions from today through the horizon, strictly inside the preferred study window, without overlaps. Prioritize nearby high-priority deadlines. Never claim the plan is guaranteed or invent deadlines.",
        },
        {
          role: "user",
          content: `Today: ${input.today}\nHorizon end: ${input.horizonEnd}\nDaily capacity: ${input.availableMinutesPerDay}\nPreferred study window: ${JSON.stringify(input.preferredStudyWindow)}\nVerified learning-state context: ${input.learningState ? learningStatePrompt(input.learningState as LearningStateSnapshot) : "No verified learning state provided."}\nDeadlines: ${JSON.stringify(input.deadlines)}\nExisting sessions: ${JSON.stringify(input.existingSessions)}\nRecurring blocks: ${JSON.stringify(input.recurringBlocks)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "student_os_schedule_draft",
          strict: true,
          schema: scheduleDraftJsonSchema,
        },
      },
    });
    const raw = response.choices[0]?.message?.content;
    const draft = parseStructuredOutput(
      raw,
      scheduleDraftSchema,
      "Schedule draft"
    );
    validateScheduleDraft(draft, input);
    validateScheduleSemanticIntegrity(draft, input);
    return draft;
  } catch (error) {
    if (signal?.aborted) throw error;
    logOperationalFailure(
      "Learning drafts",
      "Schedule generation failed",
      error
    );
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        "Student OS could not create a safe schedule draft right now. Your existing timetable has not changed; please try again shortly.",
    });
  }
}

export function resetLearningDraftModelForTests() {
  selectedModel = undefined;
}

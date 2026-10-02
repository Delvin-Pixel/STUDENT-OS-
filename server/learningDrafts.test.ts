import { beforeEach, describe, expect, it, vi } from "vitest";
import * as llm from "./_core/llm";
import {
  generateQuizDraft,
  generateScheduleDraft,
  learningDraftRequestSchema,
  resetLearningDraftModelForTests,
  scheduleDraftRequestSchema,
} from "./learningDrafts";

function questions(count = 50, duplicateAt?: number) {
  return Array.from({ length: count }, (_, index) => ({
    prompt: `In Physics, explain how waves behave in scenario ${duplicateAt === index ? 1 : index + 1}.`,
    options: ["A", "B"],
    correctOptionIndex: index % 2,
    explanation:
      "The behaviour of waves follows from the relationship between frequency and wavelength in Physics.",
  }));
}

describe("P1 learning drafts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetLearningDraftModelForTests();
  });

  it("keeps the client-selected context bounded", () => {
    expect(() =>
      learningDraftRequestSchema.parse({
        subject: "Physics",
        topic: "Waves",
        educationLevel: "Secondary",
        learningContext: "x".repeat(1_201),
      })
    ).toThrow();
  });

  it("returns exactly 50 validated reviewable quiz questions from structured server-side output", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Waves check",
              instructions: "Choose the best answer.",
              questions: questions(),
            }),
          },
        },
      ],
    } as never);
    const draft = await generateQuizDraft({
      subject: "Physics",
      topic: "Waves",
      educationLevel: "Secondary",
    });
    expect(draft.questions).toHaveLength(50);
    expect(new Set(draft.questions.map(question => question.prompt)).size).toBe(
      50
    );
    expect(llm.invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        maxCompletionTokens: 12_000,
      })
    );
  });

  it("rejects duplicate questions instead of saving an ambiguous assessment", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Duplicate",
              instructions: "Choose.",
              questions: questions(50, 1),
            }),
          },
        },
      ],
    } as never);
    await expect(
      generateQuizDraft({
        subject: "Physics",
        topic: "Waves",
        educationLevel: "Secondary",
      })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("does not cache a transient model-catalog outage and limits reasoning parameters to compatible model families", async () => {
    vi.spyOn(llm, "listLLMModels")
      .mockRejectedValueOnce(new Error("temporary catalog outage"))
      .mockResolvedValue({ data: [{ id: "claude-haiku-test" }] } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Waves check",
              instructions: "Choose.",
              questions: questions(),
            }),
          },
        },
      ],
    } as never);
    await generateQuizDraft({
      subject: "Physics",
      topic: "Waves",
      educationLevel: "Secondary",
    });
    await generateQuizDraft({
      subject: "Physics",
      topic: "Waves",
      educationLevel: "Secondary",
    });
    expect(llm.listLLMModels).toHaveBeenCalledTimes(2);
    const secondRequest = vi.mocked(llm.invokeLLM).mock.calls[1]?.[0] as Record<
      string,
      unknown
    >;
    expect(secondRequest).toMatchObject({ model: "claude-haiku-test" });
    expect(secondRequest).not.toHaveProperty("reasoning");
  });

  it("returns only a bounded, non-overlapping schedule proposal within supplied capacity", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Deadline plan",
              instructions: "Review each item.",
              sessions: [
                {
                  date: "2026-08-24",
                  startTime: "16:00",
                  duration: 60,
                  subject: "Physics",
                  topic: "Waves",
                  priority: "high",
                  reason: "Prepare for the nearest deadline.",
                  deadlineTitle: "Waves task",
                },
              ],
            }),
          },
        },
      ],
    } as never);
    const input = scheduleDraftRequestSchema.parse({
      today: "2026-08-23",
      horizonEnd: "2026-09-06",
      availableMinutesPerDay: 120,
      deadlines: [
        {
          kind: "task",
          title: "Waves task",
          subject: "Physics",
          dueDate: "2026-08-25",
          priority: "high",
          estimatedMinutes: 60,
        },
      ],
      existingSessions: [
        { date: "2026-08-24", startTime: "09:00", duration: 60 },
      ],
      recurringBlocks: [],
      preferredStudyWindow: { startTime: "15:00", endTime: "20:00" },
    });
    await expect(generateScheduleDraft(input)).resolves.toMatchObject({
      sessions: [{ subject: "Physics", duration: 60 }],
    });
  });

  it("rejects an AI schedule proposal that overlaps a supplied canonical study session", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Unsafe",
              instructions: "Review.",
              sessions: [
                {
                  date: "2026-08-24",
                  startTime: "09:30",
                  duration: 60,
                  subject: "Physics",
                  topic: "Waves",
                  priority: "high",
                  reason: "Soon.",
                  deadlineTitle: "Waves task",
                },
              ],
            }),
          },
        },
      ],
    } as never);
    const input = scheduleDraftRequestSchema.parse({
      today: "2026-08-23",
      horizonEnd: "2026-09-06",
      availableMinutesPerDay: 120,
      deadlines: [
        {
          kind: "task",
          title: "Waves task",
          subject: "Physics",
          dueDate: "2026-08-25",
          priority: "high",
          estimatedMinutes: 60,
        },
      ],
      existingSessions: [
        { date: "2026-08-24", startTime: "09:00", duration: 60 },
      ],
      recurringBlocks: [],
      preferredStudyWindow: { startTime: "08:00", endTime: "20:00" },
    });
    await expect(generateScheduleDraft(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });

  it("rejects an AI schedule proposal that exceeds daily capacity after active sessions are included", async () => {
    vi.spyOn(llm, "listLLMModels").mockResolvedValue({
      data: [{ id: "gpt-5-mini" }],
    } as never);
    vi.spyOn(llm, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Over capacity",
              instructions: "Review.",
              sessions: [
                {
                  date: "2026-08-24",
                  startTime: "16:00",
                  duration: 60,
                  subject: "Physics",
                  topic: "Waves",
                  priority: "high",
                  reason: "Soon.",
                  deadlineTitle: "Waves task",
                },
              ],
            }),
          },
        },
      ],
    } as never);
    const input = scheduleDraftRequestSchema.parse({
      today: "2026-08-23",
      horizonEnd: "2026-09-06",
      availableMinutesPerDay: 90,
      deadlines: [
        {
          kind: "task",
          title: "Waves task",
          subject: "Physics",
          dueDate: "2026-08-25",
          priority: "high",
          estimatedMinutes: 60,
        },
      ],
      existingSessions: [
        { date: "2026-08-24", startTime: "09:00", duration: 60 },
      ],
      recurringBlocks: [],
      preferredStudyWindow: { startTime: "08:00", endTime: "20:00" },
    });
    await expect(generateScheduleDraft(input)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });
});

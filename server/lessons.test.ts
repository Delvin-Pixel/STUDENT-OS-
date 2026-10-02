import { afterEach, describe, expect, it, vi } from "vitest";
import * as imageGenerationModule from "./_core/imageGeneration";
import * as llmModule from "./_core/llm";
import {
  answerDailyLessonQuestion,
  buildFallbackAnswer,
  buildFallbackLesson,
  DAILY_LESSON_TIMEOUT_MS,
  lessonRequestSchema,
  lessonSchema,
  questionRequestSchema,
  TUTOR_RESPONSE_TIMEOUT_MS,
} from "./lessons";

describe("Daily Lessons contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("accepts a level-aware lesson request", () => {
    expect(
      lessonRequestSchema.parse({
        subject: "Science",
        branch: "Physics",
        topic: "Forces and motion",
        educationLevel: "Secondary",
        age: 15,
      })
    ).toMatchObject({ subject: "Science", educationLevel: "Secondary" });
  });

  it("rejects an empty follow-up question", () => {
    expect(() =>
      questionRequestSchema.parse({
        question: " ",
        subject: "Mathematics",
        topic: "Fractions",
        educationLevel: "Primary",
        lessonContext: "A fraction is part of a whole.",
      })
    ).toThrow();
  });

  it("validates a structured lesson before it reaches the student", () => {
    expect(() => lessonSchema.parse({ title: "Incomplete" })).toThrow();
  });

  it("allows a realistic bounded response window for structured AI lessons", () => {
    expect(DAILY_LESSON_TIMEOUT_MS).toBe(15_000);
    expect(TUTOR_RESPONSE_TIMEOUT_MS).toBe(20_000);
  });

  it("provides a complete, level-aware local lesson when the AI service is unavailable", () => {
    const lesson = buildFallbackLesson(
      lessonRequestSchema.parse({
        subject: "Mathematics",
        branch: "Algebra",
        topic: "Solving linear equations",
        educationLevel: "Secondary",
        age: 14,
      })
    );
    expect(lesson.title).toBe("Solving linear equations");
    expect(lesson.learningGoals).toHaveLength(3);
    expect(lesson.diagram.nodes.length).toBeGreaterThan(2);
  });

  it("provides a direct lesson-grounded answer if a follow-up cannot reach an online tutor", () => {
    const answer = buildFallbackAnswer(
      questionRequestSchema.parse({
        question: "Why do I use inverse operations?",
        subject: "Mathematics",
        topic: "Solving linear equations",
        educationLevel: "Secondary",
        lessonContext: "Use the same inverse operation on both sides.",
      })
    );
    expect(answer.answerMarkdown).toContain("**The main reason is:**");
    expect(answer.answerMarkdown).toContain("Why do I use inverse operations?");
    expect(answer.answerMarkdown).toContain(
      "Use the same inverse operation on both sides."
    );
    expect(answer.answerMarkdown).not.toContain(
      "Please send the question again"
    );
  });

  it("answers a types-of-matter question directly when the tutor service is unavailable", () => {
    const answer = buildFallbackAnswer(
      questionRequestSchema.parse({
        question: "What are the types of matter?",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );
    expect(answer.answerMarkdown).toContain(
      "**solid**, **liquid**, and **gas**"
    );
    expect(answer.answerMarkdown).toContain("**Plasma:**");
    expect(answer.answerMarkdown).not.toContain("Let’s unpack");
  });

  it("keeps the OpenAI source tag distinct from the reusable local fallback contract", () => {
    const answer = buildFallbackAnswer(
      questionRequestSchema.parse({
        question: "What are the types of matter?",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );
    expect(answer).not.toHaveProperty("source");
    expect(answer.answerMarkdown).toContain("solid");
  });

  it("labels a response as OpenAI only when the LLM service returns an answer", async () => {
    vi.spyOn(llmModule, "listLLMModels").mockResolvedValue({
      object: "list",
      data: [
        { id: "gpt-4.1-mini", object: "model", created: 0, owned_by: "test" },
      ],
    });
    vi.spyOn(llmModule, "invokeLLM").mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              answerMarkdown: "Matter can be solid, liquid, or gas.",
              checkYourThinking: "How do particles move in a gas?",
              wantsMedia: false,
            }),
          },
        },
      ],
    } as unknown as llmModule.InvokeResult);

    const answer = await answerDailyLessonQuestion(
      questionRequestSchema.parse({
        question: "What are the types of matter?",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );

    expect(answer).toMatchObject({
      source: "openai",
      answerMarkdown: "Matter can be solid, liquid, or gas.",
    });
    expect(llmModule.invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4.1-mini",
        maxCompletionTokens: 1100,
      })
    );
  });

  it("attaches an AI-generated visual when a media request is made through the lesson Q&A", async () => {
    vi.spyOn(llmModule, "invokeLLM").mockImplementation(async params => {
      const schemaName =
        params.response_format?.type === "json_schema"
          ? params.response_format.json_schema.name
          : undefined;
      if (schemaName === "tutor_answer") {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answerMarkdown: "A solid keeps its shape.",
                  checkYourThinking: "Why?",
                  wantsMedia: true,
                }),
              },
            },
          ],
        } as unknown as llmModule.InvokeResult;
      }
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ prompt: "States of matter diagram" }),
            },
          },
        ],
      } as unknown as llmModule.InvokeResult;
    });
    vi.spyOn(imageGenerationModule, "generateImage").mockResolvedValue({
      url: "https://example.com/media.png",
    });

    const answer = await answerDailyLessonQuestion(
      questionRequestSchema.parse({
        question: "Create a diagram showing the states of matter",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );

    expect(answer.source).toBe("openai");
    if (answer.source !== "openai")
      throw new Error("Expected an OpenAI response");
    expect(answer.media?.url).toBe("https://example.com/media.png");
    expect(answer.media?.caption).toContain("states of matter");
  });

  it("honours validated model media intent when an explicit visual request uses non-keyword wording", async () => {
    vi.spyOn(llmModule, "invokeLLM").mockImplementation(async params => {
      const schemaName =
        params.response_format?.type === "json_schema"
          ? params.response_format.json_schema.name
          : undefined;
      if (schemaName === "tutor_answer") {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answerMarkdown: "Particle motion differs by state.",
                  checkYourThinking: "Compare two states.",
                  wantsMedia: true,
                }),
              },
            },
          ],
        } as unknown as llmModule.InvokeResult;
      }
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                prompt: "Labeled particle-motion comparison",
              }),
            },
          },
        ],
      } as unknown as llmModule.InvokeResult;
    });
    vi.spyOn(imageGenerationModule, "generateImage").mockResolvedValue({
      url: "https://example.com/particle-motion.png",
    });

    const answer = await answerDailyLessonQuestion(
      questionRequestSchema.parse({
        question: "Could a visual help me compare particle movement?",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );

    expect(answer.source).toBe("openai");
    if (answer.source !== "openai")
      throw new Error("Expected an OpenAI response");
    expect(answer.media?.url).toBe("https://example.com/particle-motion.png");
  });

  it("falls back directly instead of waiting for another model when the LLM service is unavailable", async () => {
    vi.spyOn(llmModule, "invokeLLM").mockRejectedValue(
      new Error("network unavailable")
    );

    const answer = await answerDailyLessonQuestion(
      questionRequestSchema.parse({
        question: "What are the types of matter?",
        subject: "Science",
        topic: "Particles and changes of state",
        educationLevel: "Secondary",
        lessonContext: "Matter is made of particles.",
      })
    );

    expect(answer).toMatchObject({ source: "studentos" });
    expect(answer.answerMarkdown).toContain(
      "**solid**, **liquid**, and **gas**"
    );
  });

  it("gives a mathematically accurate local explanation for a negative-power question", () => {
    const answer = buildFallbackAnswer(
      questionRequestSchema.parse({
        question: "Why does a negative power mean reciprocal?",
        subject: "Mathematics",
        topic: "Powers and standard form",
        educationLevel: "Secondary",
        lessonContext: "Index laws.",
      })
    );
    expect(answer.answerMarkdown).toContain("a^{-n} = 1/a^n");
    expect(answer.answerMarkdown).toContain("2^{-2}");
  });
  it("forwards a protected request signal through lesson Q&A and media generation", async () => {
    const controller = new AbortController();
    vi.spyOn(llmModule, "invokeLLM").mockImplementation(async params => {
      const schemaName =
        params.response_format?.type === "json_schema"
          ? params.response_format.json_schema.name
          : undefined;
      if (schemaName === "tutor_answer") {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  answerMarkdown: "Direct answer.",
                  checkYourThinking: "Why?",
                  wantsMedia: true,
                }),
              },
            },
          ],
        } as unknown as llmModule.InvokeResult;
      }
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ prompt: "Educational diagram" }),
            },
          },
        ],
      } as unknown as llmModule.InvokeResult;
    });
    const generateMock = vi
      .spyOn(imageGenerationModule, "generateImage")
      .mockResolvedValue({ url: "https://example.com/media.png" });

    await answerDailyLessonQuestion(
      questionRequestSchema.parse({
        question: "Create a diagram showing matter",
        subject: "Science",
        topic: "States of matter",
        educationLevel: "Secondary",
        lessonContext: "Particles move differently.",
      }),
      controller.signal
    );

    const signals = vi
      .mocked(llmModule.invokeLLM)
      .mock.calls.map(([params]) => params.signal);
    expect(signals.length).toBeGreaterThan(0);
    for (const signal of signals) {
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(false);
    }
    expect(generateMock).toHaveBeenCalledWith({
      prompt: "Educational diagram",
      signal: controller.signal,
    });
    controller.abort();
    for (const signal of signals) expect(signal?.aborted).toBe(true);
  });
});

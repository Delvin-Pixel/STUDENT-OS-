import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    openAiApiBaseUrl: "https://provider.test.invalid",
    openAiApiKey: "fixture-only",
  },
}));
import {
  generateQuizDraft,
  resetLearningDraftModelForTests,
} from "./learningDrafts";

const marker = "private-upstream-detail";
const request = {
  subject: "ICT",
  topic: "Database normalization",
  educationLevel: "SHS",
};
const valid = () => ({
  title: "Practice draft",
  instructions: "Review each answer.",
  questions: Array.from({ length: 50 }, (_, i) => ({
    prompt: `ICT database normalization scenario ${i + 1}: which design avoids redundant data?`,
    options: ["Separate related entities", "Duplicate all fields"],
    correctOptionIndex: 0,
    explanation:
      "Normalization reduces redundancy by organizing related data into separate relations.",
  })),
});
const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { "content-type": "application/json" },
  });
function provider(response: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/models")
        ? new Response(JSON.stringify({ data: [{ id: "gpt-5-mini" }] }), {
            headers: { "content-type": "application/json" },
          })
        : response()
    )
  );
}

beforeEach(() => {
  resetLearningDraftModelForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("quiz draft through real transport and output validation (mocked provider)", () => {
  it.each(["JHS", "SHS", "tertiary"])(
    "returns reviewable drafts for %s without granting mastery",
    async educationLevel => {
      provider(() => completion(JSON.stringify(valid())));
      const result = await generateQuizDraft({ ...request, educationLevel });
      expect(result.questions).toHaveLength(50);
      expect(result).not.toHaveProperty("mastery");
      expect(result).not.toHaveProperty("verified");
    }
  );

  const invalidCases: Array<[string, () => Response]> = [
    [
      "HTML proxy page",
      () =>
        new Response(`<html>${marker}</html>`, {
          headers: { "content-type": "text/html" },
        }),
    ],
    [
      "malformed outer JSON",
      () =>
        new Response(`{${marker}`, {
          headers: { "content-type": "application/json" },
        }),
    ],
    ["malformed model JSON", () => completion(`{${marker}`)],
    [
      "missing questions",
      () =>
        completion(JSON.stringify({ title: marker, instructions: "Review" })),
    ],
    [
      "invalid options",
      () =>
        completion(
          JSON.stringify({
            ...valid(),
            questions: valid().questions.map(q => ({
              ...q,
              options: ["only one"],
            })),
          })
        ),
    ],
    [
      "out of range answer",
      () =>
        completion(
          JSON.stringify({
            ...valid(),
            questions: valid().questions.map(q => ({
              ...q,
              correctOptionIndex: 3,
            })),
          })
        ),
    ],
    [
      "oversized transport",
      () =>
        new Response("x".repeat(2_000_001), {
          headers: { "content-type": "application/json" },
        }),
    ],
    ["zero credits", () => new Response(marker, { status: 402 })],
    ["rate limit", () => new Response(marker, { status: 429 })],
    ["gateway unavailable", () => new Response(marker, { status: 503 })],
  ];
  it.each(invalidCases)("fails safely for %s", async (_name, response) => {
    const logs = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    provider(response);
    const error = await generateQuizDraft(request).catch(error => error);
    expect(error).toMatchObject({ code: "BAD_GATEWAY" });
    expect(error.message).toContain("existing study data has not changed");
    expect(error.message).not.toContain(marker);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(marker);
  });
});

import type { NextAction } from "@/lib/learningIntelligence";
import { describe, expect, it } from "vitest";
import { getTodayRecommendation } from "./Today";

const baseAction: Omit<NextAction, "kind" | "id"> = {
  title: "Waves",
  detail: "Exam in 2 days",
  subject: "Physics",
  topic: "Waves",
  duration: 30,
  score: 900,
  reason: "Review",
  route: "/study",
};

describe("Today recommendation selection", () => {
  it("keeps ranked study and flashcard actions visible when no task or session takes priority", () => {
    expect(
      getTodayRecommendation({
        ...baseAction,
        id: "exam-topic:e:w",
        kind: "study",
      })
    ).toMatchObject({ kind: "study", title: "Waves" });
    expect(
      getTodayRecommendation({
        ...baseAction,
        id: "flashcards:due",
        kind: "flashcards",
        route: "/flashcards",
      })
    ).toMatchObject({ kind: "flashcards", route: "/flashcards" });
  });

  it("does not replace task or session lifecycle controls", () => {
    expect(
      getTodayRecommendation({ ...baseAction, id: "task:1", kind: "task" })
    ).toBeNull();
    expect(
      getTodayRecommendation({
        ...baseAction,
        id: "session:1",
        kind: "session",
      })
    ).toBeNull();
  });
});

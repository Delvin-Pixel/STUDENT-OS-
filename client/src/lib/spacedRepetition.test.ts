import { describe, expect, it } from "vitest";
import { getDueFlashcards, scheduleFlashcardReview } from "./spacedRepetition";

const card = {
  id: "card",
  front: "Question",
  back: "Answer",
  status: "new" as const,
};

describe("scheduleFlashcardReview", () => {
  it("queues only new and due cards, never future-scheduled cards", () => {
    const cards = [
      { id: "new", front: "Q", back: "A", status: "new" as const },
      {
        id: "due",
        front: "Q",
        back: "A",
        status: "easy" as const,
        nextReviewDate: "2026-08-23",
      },
      {
        id: "future",
        front: "Q",
        back: "A",
        status: "easy" as const,
        nextReviewDate: "2026-08-24",
      },
    ];
    expect(
      getDueFlashcards(cards, "2026-08-23").map(current => current.id)
    ).toEqual(["new", "due"]);
  });

  it("resurfaces a forgotten card quickly and records a lapse", () => {
    const result = scheduleFlashcardReview(
      { ...card, intervalDays: 12, easeFactor: 2.4, lapses: 1 },
      "again",
      "2026-08-22"
    );
    expect(result.intervalDays).toBe(1);
    expect(result.nextReviewDate).toBe("2026-08-23");
    expect(result.lapses).toBe(2);
    expect(result.status).toBe("difficult");
  });

  it("spaces a successful easy review farther than a good review", () => {
    const good = scheduleFlashcardReview(
      { ...card, intervalDays: 4 },
      "good",
      "2026-08-22"
    );
    const easy = scheduleFlashcardReview(
      { ...card, intervalDays: 4 },
      "easy",
      "2026-08-22"
    );
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays!);
    expect(easy.retentionEstimate).toBeGreaterThan(good.retentionEstimate!);
  });
});

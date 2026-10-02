import type { Flashcard } from "./types";
import { addDays, todayStr } from "./utils";

export type ReviewGrade = "again" | "hard" | "good" | "easy";

/**
 * New cards and cards due on or before the learner's local study date belong in
 * a review session. Future cards deliberately remain out of the queue so a
 * learner is not prompted to rehearse them ahead of the spaced-repetition plan.
 */
export function getDueFlashcards(
  cards: Flashcard[],
  date = todayStr()
): Flashcard[] {
  return cards
    .filter(card => {
      const due = card.nextReviewDate ?? card.dueDate;
      return !due || due <= date;
    })
    .sort((a, b) =>
      (a.nextReviewDate ?? a.dueDate ?? "").localeCompare(
        b.nextReviewDate ?? b.dueDate ?? ""
      )
    );
}

/**
 * A compact SM-2-inspired scheduler. The result remains learner-editable and
 * uses local calendar dates so reviews are useful while offline.
 */
export function scheduleFlashcardReview(
  card: Flashcard,
  grade: ReviewGrade,
  date = todayStr()
): Partial<Flashcard> {
  const priorInterval = Math.max(1, card.intervalDays ?? 1);
  const priorEase = Math.min(3.5, Math.max(1.3, card.easeFactor ?? 2.15));
  const adjustments = {
    again: {
      interval: 1,
      ease: -0.2,
      retention: 0.45,
      status: "difficult" as const,
      lapse: 1,
    },
    hard: {
      interval: Math.max(2, Math.round(priorInterval * 1.25)),
      ease: -0.08,
      retention: 0.66,
      status: "difficult" as const,
      lapse: 0,
    },
    good: {
      interval: Math.max(2, Math.round(priorInterval * priorEase)),
      ease: 0,
      retention: 0.82,
      status: "easy" as const,
      lapse: 0,
    },
    easy: {
      interval: Math.max(4, Math.round(priorInterval * (priorEase + 0.35))),
      ease: 0.12,
      retention: 0.93,
      status: "easy" as const,
      lapse: 0,
    },
  }[grade];
  const easeFactor = Math.max(1.3, Math.min(3.5, priorEase + adjustments.ease));
  return {
    status: adjustments.status,
    intervalDays: adjustments.interval,
    dueDate: addDays(date, adjustments.interval),
    nextReviewDate: addDays(date, adjustments.interval),
    lastReviewedAt: date,
    reviewCount: (card.reviewCount ?? 0) + 1,
    easeFactor,
    lapses: (card.lapses ?? 0) + adjustments.lapse,
    retentionEstimate: adjustments.retention,
  };
}

import { describe, expect, it } from "vitest";
import {
  applyAiAnswerRating,
  feedbackReasonLabel,
  summarizeAiAnswerRatings,
} from "./answerRatings";

describe("applyAiAnswerRating", () => {
  it("replaces an earlier rating for the same private answer record", () => {
    const ratings = applyAiAnswerRating(
      [
        {
          answerId: "a",
          surface: "lesson",
          rating: "up",
          answerPreview: "First answer",
          ratedAt: "2026-08-22T10:00:00.000Z",
        },
      ],
      {
        answerId: "a",
        surface: "lesson",
        rating: "down",
        answerPreview: "Updated answer",
        reason: "needs_example",
        ratedAt: "2026-08-22T10:01:00.000Z",
      }
    );
    expect(ratings).toEqual([
      {
        answerId: "a",
        surface: "lesson",
        rating: "down",
        answerPreview: "Updated answer",
        reason: "needs_example",
        ratedAt: "2026-08-22T10:01:00.000Z",
      },
    ]);
  });

  it("retains only the latest one hundred private ratings", () => {
    const existing = Array.from({ length: 100 }, (_, index) => ({
      answerId: String(index),
      surface: "assistant" as const,
      rating: "up" as const,
      answerPreview: String(index),
      ratedAt: String(index),
    }));
    const ratings = applyAiAnswerRating(existing, {
      answerId: "new",
      surface: "assistant",
      rating: "down",
      answerPreview: "New",
      ratedAt: "now",
    });
    expect(ratings).toHaveLength(100);
    expect(ratings[0].answerId).toBe("new");
    expect(ratings.some(rating => rating.answerId === "0")).toBe(true);
    expect(ratings.some(rating => rating.answerId === "99")).toBe(false);
  });

  it("orders a private feedback summary and calculates helpfulness totals", () => {
    const summary = summarizeAiAnswerRatings([
      {
        answerId: "old",
        surface: "lesson",
        rating: "down",
        answerPreview: "Older",
        ratedAt: "2026-08-20T10:00:00.000Z",
      },
      {
        answerId: "new",
        surface: "assistant",
        rating: "up",
        answerPreview: "Newer",
        ratedAt: "2026-08-22T10:00:00.000Z",
      },
    ]);
    expect(summary).toMatchObject({
      total: 2,
      helpful: 1,
      notHelpful: 1,
      helpfulPercent: 50,
    });
    expect(summary.ordered[0].answerId).toBe("new");
  });

  it("returns a safe empty summary when the learner has not rated any answers", () => {
    expect(summarizeAiAnswerRatings([])).toEqual({
      ordered: [],
      total: 0,
      helpful: 0,
      notHelpful: 0,
      helpfulPercent: 0,
    });
  });

  it("maps private thumbs-down reasons to learner-readable labels", () => {
    expect(feedbackReasonLabel("missed_question")).toBe(
      "Didn’t answer my question"
    );
    expect(feedbackReasonLabel()).toBeUndefined();
  });
});

import type { AiAnswerFeedbackReason, AiAnswerRating } from "./types";

export const AI_ANSWER_FEEDBACK_REASON_OPTIONS: Array<{
  value: AiAnswerFeedbackReason;
  label: string;
}> = [
  { value: "too_vague", label: "Too vague" },
  { value: "missed_question", label: "Didn’t answer my question" },
  { value: "too_complex", label: "Too difficult to follow" },
  { value: "may_be_inaccurate", label: "May be inaccurate" },
  { value: "needs_example", label: "Needed an example or visual" },
];

export function feedbackReasonLabel(reason?: AiAnswerFeedbackReason) {
  return AI_ANSWER_FEEDBACK_REASON_OPTIONS.find(
    option => option.value === reason
  )?.label;
}

export function applyAiAnswerRating(
  existing: AiAnswerRating[],
  next: AiAnswerRating
): AiAnswerRating[] {
  return [
    next,
    ...existing.filter(
      rating =>
        !(rating.answerId === next.answerId && rating.surface === next.surface)
    ),
  ].slice(0, 100);
}

export function summarizeAiAnswerRatings(ratings: AiAnswerRating[]) {
  const ordered = [...ratings].sort((a, b) =>
    b.ratedAt.localeCompare(a.ratedAt)
  );
  const helpful = ordered.filter(rating => rating.rating === "up").length;
  return {
    ordered,
    total: ordered.length,
    helpful,
    notHelpful: ordered.length - helpful,
    helpfulPercent: ordered.length
      ? Math.round((helpful / ordered.length) * 100)
      : 0,
  };
}

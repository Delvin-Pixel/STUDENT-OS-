import { getAssessmentIntelligence } from "./assessmentIntelligence";
import type { StudyState } from "./types";

export type FocusedAssessmentRequest = {
  mode: "diagnostic" | "remediation_verification" | "fresh_recheck";
  focusConcepts: string[];
  weakConcepts: string[];
  recentMisses: string[];
  excludeQuestionPrompts: string[];
  difficultyGuidance: "mixed" | "foundation" | "application";
  rationale: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildFocusedAssessmentRequest(
  state: StudyState,
  topicId: string,
  mode: FocusedAssessmentRequest["mode"] = "diagnostic"
): FocusedAssessmentRequest {
  const intelligence = getAssessmentIntelligence(state, topicId);
  const primary = intelligence.primarySignal;
  const attempts = state.quizAttempts
    .filter(
      attempt =>
        (attempt.topicId ??
          state.quizzes.find(q => q.id === attempt.quizId)?.topicId) === topicId
    )
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const recentMisses = attempts
    .slice(-3)
    .flatMap(attempt =>
      (attempt.responses ?? [])
        .filter(response => !response.correct)
        .map(response => response.subtopic?.trim() || "General topic")
    )
    .filter(
      (value, index, all) =>
        all.findIndex(
          candidate => normalize(candidate) === normalize(value)
        ) === index
    )
    .slice(0, 8);
  const excludeQuestionPrompts = attempts
    .slice(-3)
    .flatMap(attempt =>
      (attempt.responses ?? []).map(response => response.prompt.trim())
    )
    .filter(Boolean)
    .filter(
      (value, index, all) =>
        all.findIndex(
          candidate => normalize(candidate) === normalize(value)
        ) === index
    )
    .slice(-20);
  const focusConcepts = [
    primary?.label,
    ...intelligence.conceptSignals
      .filter(signal => signal.misses > 0)
      .map(signal => signal.label),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter(
      (value, index, all) =>
        all.findIndex(
          candidate => normalize(candidate) === normalize(value)
        ) === index
    )
    .slice(0, 6);

  const modeRationale =
    mode === "diagnostic"
      ? "Locate the weak concept with fresh questions rather than repeating prior evidence."
      : mode === "remediation_verification"
        ? "Verify whether the targeted remediation improved the previously weak concept using unseen questions."
        : "Recheck the concept with fresh question wording after prior assessment evidence.";

  return {
    mode,
    focusConcepts,
    weakConcepts: focusConcepts,
    recentMisses,
    excludeQuestionPrompts,
    difficultyGuidance:
      primary?.severity === "high"
        ? "foundation"
        : primary?.severity === "medium"
          ? "mixed"
          : "application",
    rationale: modeRationale,
  };
}

import type { StudyState } from "@/lib/types";

/**
 * Returns the first-run onboarding view without discarding the learner's
 * existing work. Settings uses this so a student can revise their profile
 * details while keeping tasks, notes, exam plans, and progress intact.
 */
export function restartOnboardingState(state: StudyState): StudyState {
  return {
    ...state,
    onboarded: false,
    profile: null,
    academicJourney: undefined,
  };
}

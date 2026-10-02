import { isValidLocalIsoDate } from "./calendarValidation";
import type { Goal } from "./types";

const GOAL_CATEGORIES: readonly Goal["category"][] = [
  "study",
  "tasks",
  "flashcards",
  "focus",
  "custom",
];

/** Mirrors canonical goal bounds while preserving an empty optional deadline as a workspace string. */
export function validateNewGoal(
  goal: Omit<Goal, "id" | "completed">
): string | null {
  if (!goal.name.trim() || goal.name.trim().length > 1_000)
    return "Give the goal a name of up to 1,000 characters.";
  if (!GOAL_CATEGORIES.includes(goal.category))
    return "Choose a valid goal category.";
  if (
    !Number.isFinite(goal.target) ||
    goal.target <= 0 ||
    goal.target > 10_000_000
  )
    return "Set a target greater than zero within the supported range.";
  if (
    !Number.isFinite(goal.current) ||
    goal.current < 0 ||
    goal.current > goal.target
  )
    return "Set valid goal progress within the target.";
  if (!goal.unit.trim() || goal.unit.trim().length > 1_000)
    return "Give the goal a unit name of up to 1,000 characters.";
  if (goal.deadline !== "" && !isValidLocalIsoDate(goal.deadline))
    return "Choose a valid local calendar deadline.";
  return null;
}

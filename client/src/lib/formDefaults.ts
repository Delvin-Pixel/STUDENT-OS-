import type { Exam, StudySession } from "./types";

export type SessionDialogDefaults = Pick<
  StudySession,
  | "subject"
  | "topic"
  | "date"
  | "startTime"
  | "duration"
  | "difficulty"
  | "priority"
  | "notes"
>;

export type ExamDialogDefaults = Pick<
  Exam,
  "subject" | "name" | "date" | "time" | "location" | "notes"
>;

/** Creates a fresh set of dialog fields whenever the Study Planner dialog opens. */
export function sessionDialogDefaults(
  editing: StudySession | null
): SessionDialogDefaults {
  return {
    subject: editing?.subject ?? "",
    topic: editing?.topic ?? "",
    date: editing?.date ?? "",
    startTime: editing?.startTime ?? "09:00",
    duration: editing?.duration ?? 60,
    difficulty: editing?.difficulty ?? "medium",
    priority: editing?.priority ?? "medium",
    notes: editing?.notes ?? "",
  };
}

/** Creates a fresh set of dialog fields whenever the Exam Center dialog opens. */
export function examDialogDefaults(editing: Exam | null): ExamDialogDefaults {
  return {
    subject: editing?.subject ?? "",
    name: editing?.name ?? "",
    date: editing?.date ?? "",
    time: editing?.time ?? "",
    location: editing?.location ?? "",
    notes: editing?.notes ?? "",
  };
}

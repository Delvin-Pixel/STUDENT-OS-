import { isValidLocalIsoDate } from "./calendarValidation";
import type { Exam } from "./types";

export type NewExam = Omit<Exam, "id" | "topics">;

const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Produces the canonical, bounded form of editable exam text fields. */
export function normalizeNewExam(exam: NewExam): NewExam {
  return {
    ...exam,
    subject: exam.subject.trim(),
    name: exam.name.trim(),
    time: exam.time.trim(),
    location: exam.location.trim(),
    notes: exam.notes.trim(),
  };
}

/** Mirrors the canonical workspace exam bounds before an optimistic local write. */
export function validateNewExam(exam: NewExam): string | null {
  const subject = exam.subject.trim();
  const name = exam.name.trim();
  const time = exam.time.trim();
  if (!subject || subject.length > 1_000)
    return "Choose a subject of up to 1,000 characters.";
  if (!name || name.length > 1_000)
    return "Give the exam a name of up to 1,000 characters.";
  if (!isValidLocalIsoDate(exam.date))
    return "Choose a valid local calendar exam date.";
  if (time && (!CLOCK_TIME.test(time) || time.length > 16))
    return "Choose a valid exam time.";
  if (exam.location.trim().length > 1_000)
    return "Keep the location to 1,000 characters or fewer.";
  if (exam.notes.trim().length > 20_000)
    return "Keep the exam notes to 20,000 characters or fewer.";
  return null;
}

/** Validates an exam topic before attaching it to the current canonical exam. */
export function validateNewExamTopicName(name: string): string | null {
  if (!name) return "Give the topic a name.";
  if (name.length > 1_000)
    return "Keep the topic name to 1,000 characters or fewer.";
  return null;
}

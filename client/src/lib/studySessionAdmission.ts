import { isValidLocalIsoDate } from "@/lib/calendarValidation";
import {
  hasActiveSessionOverlap,
  hasRecurringTimetableOverlap,
} from "@/lib/sessionScheduling";
import type { StudySession, StudyState } from "@/lib/types";
import { WORKSPACE_STUDY_SESSION_LIMIT } from "@shared/workspaceSchema";

export type NewStudySession = Pick<
  StudySession,
  | "subject"
  | "topic"
  | "topicId"
  | "date"
  | "startTime"
  | "duration"
  | "difficulty"
  | "priority"
  | "notes"
  | "status"
>;
export type StudySessionPlanLink = Pick<StudySession, "planId" | "planItemId">;
export type StudySessionAdmissionReason =
  | "invalid"
  | "capacity"
  | "stale_topic"
  | "session_overlap"
  | "timetable_overlap";

export type StudySessionAdmission =
  | { accepted: true; session: NewStudySession }
  | { accepted: false; reason: StudySessionAdmissionReason };

export function normalizeStudySessionDraft(
  value: NewStudySession
): NewStudySession | null {
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const topic = typeof value.topic === "string" ? value.topic.trim() : "";
  const notes = typeof value.notes === "string" ? value.notes.trim() : "";
  const difficulties = ["easy", "medium", "hard"] as const;
  const priorities = ["high", "medium", "low"] as const;
  const statuses = [
    "planned",
    "in_progress",
    "paused",
    "completed",
    "skipped",
    "rescheduled",
  ] as const;
  if (
    !subject ||
    subject.length > 1_000 ||
    topic.length > 1_000 ||
    notes.length > 10_000 ||
    !isValidLocalIsoDate(value.date) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) ||
    !Number.isInteger(value.duration) ||
    value.duration < 1 ||
    value.duration > 1_440 ||
    !difficulties.includes(value.difficulty) ||
    !priorities.includes(value.priority) ||
    !statuses.includes(value.status) ||
    (value.topicId !== undefined &&
      (typeof value.topicId !== "string" ||
        !value.topicId ||
        value.topicId.length > 160))
  )
    return null;
  return {
    subject,
    topic,
    ...(value.topicId ? { topicId: value.topicId } : {}),
    date: value.date,
    startTime: value.startTime,
    duration: value.duration,
    difficulty: value.difficulty,
    priority: value.priority,
    notes,
    status: value.status,
  };
}

export function admitPlannedStudySession(
  state: Pick<StudyState, "sessions" | "topics" | "exams" | "events">,
  draft: NewStudySession,
  link?: StudySessionPlanLink
): StudySessionAdmission {
  const normalized = normalizeStudySessionDraft(draft);
  if (
    !normalized ||
    normalized.status !== "planned" ||
    (link &&
      (typeof link.planId !== "string" ||
        !link.planId ||
        link.planId.length > 160 ||
        typeof link.planItemId !== "string" ||
        !link.planItemId ||
        link.planItemId.length > 160))
  )
    return { accepted: false, reason: "invalid" };
  if (state.sessions.length >= WORKSPACE_STUDY_SESSION_LIMIT)
    return { accepted: false, reason: "capacity" };
  const linkedTopic = normalized.topicId
    ? [
        ...state.topics.map(topic => ({
          id: topic.id,
          subject: topic.subject,
        })),
        ...state.exams.flatMap(exam =>
          exam.topics.map(topic => ({ id: topic.id, subject: exam.subject }))
        ),
      ].find(topic => topic.id === normalized.topicId)
    : undefined;
  if (normalized.topicId && !linkedTopic)
    return { accepted: false, reason: "stale_topic" };
  if (hasActiveSessionOverlap(state.sessions, normalized))
    return { accepted: false, reason: "session_overlap" };
  if (hasRecurringTimetableOverlap(state.events, normalized))
    return { accepted: false, reason: "timetable_overlap" };
  return {
    accepted: true,
    session: {
      ...normalized,
      ...(linkedTopic ? { subject: linkedTopic.subject } : {}),
    },
  };
}

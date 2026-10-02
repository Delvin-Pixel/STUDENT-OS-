import type { StudyNote, StudyState } from "./types";

export type NoteDraft = Pick<
  StudyNote,
  "title" | "subject" | "topicId" | "content" | "pinned"
>;

export function createStudyNote(
  draft: NoteDraft,
  id: string,
  timestamp: string
): StudyNote {
  return { ...draft, id, createdAt: timestamp, updatedAt: timestamp };
}

export function addStudyNote(state: StudyState, note: StudyNote): StudyState {
  return { ...state, notes: [note, ...state.notes] };
}

export function updateStudyNote(
  state: StudyState,
  id: string,
  patch: Partial<NoteDraft>,
  timestamp: string
): StudyState {
  return {
    ...state,
    notes: state.notes.map(note =>
      note.id === id ? { ...note, ...patch, updatedAt: timestamp } : note
    ),
  };
}

export function removeStudyNote(state: StudyState, id: string): StudyState {
  return { ...state, notes: state.notes.filter(note => note.id !== id) };
}

import type { NoteDraft } from "./notes";

export function normalizeNoteDraft(note: NoteDraft): NoteDraft {
  return {
    ...note,
    title: note.title.trim(),
    subject: note.subject.trim(),
    content: note.content.trim(),
  };
}

/** Mirrors canonical workspace note bounds before a local-first mutation. */
export function validateNoteDraft(note: NoteDraft): string | null {
  if (!note.title.trim() || note.title.trim().length > 1_000)
    return "Give the note a title of up to 1,000 characters.";
  if (!note.subject.trim() || note.subject.trim().length > 1_000)
    return "Choose a note subject of up to 1,000 characters.";
  if (!note.content.trim() || note.content.trim().length > 20_000)
    return "Give the note details of up to 20,000 characters.";
  return null;
}

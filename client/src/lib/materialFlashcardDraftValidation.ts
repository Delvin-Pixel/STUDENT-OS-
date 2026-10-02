import type { Exam, SubjectTopic } from "@/lib/types";

export type MaterialFlashcardDraft = {
  title: string;
  subject: string;
  topicId?: string;
  keyIdeas: string[];
};
export type MaterialFlashcardDraftAdmission =
  | {
      accepted: true;
      draft: {
        title: string;
        subject: string;
        topicId?: string;
        keyIdeas: string[];
      };
    }
  | { accepted: false; reason: "invalid" | "stale_topic" | "deck_capacity" };

export function admitMaterialFlashcardDraft(
  draft: MaterialFlashcardDraft,
  context: {
    deckCount: number;
    topics: SubjectTopic[];
    exams: Exam[];
    deckLimit: number;
  }
): MaterialFlashcardDraftAdmission {
  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const subject = typeof draft.subject === "string" ? draft.subject.trim() : "";
  if (
    !title ||
    title.length > 1_000 ||
    !subject ||
    subject.length > 1_000 ||
    !Array.isArray(draft.keyIdeas) ||
    draft.keyIdeas.length < 3 ||
    draft.keyIdeas.length > 2_000 ||
    context.deckCount >= context.deckLimit
  )
    return {
      accepted: false,
      reason:
        context.deckCount >= context.deckLimit ? "deck_capacity" : "invalid",
    };
  const keyIdeas: string[] = [];
  for (const idea of draft.keyIdeas) {
    if (typeof idea !== "string") return { accepted: false, reason: "invalid" };
    const clean = idea.trim();
    if (!clean || clean.length > 20_000)
      return { accepted: false, reason: "invalid" };
    keyIdeas.push(clean);
  }
  const linkedTopic = draft.topicId
    ? [
        ...context.topics.map(topic => ({
          id: topic.id,
          subject: topic.subject,
        })),
        ...context.exams.flatMap(exam =>
          exam.topics.map(topic => ({ id: topic.id, subject: exam.subject }))
        ),
      ].find(topic => topic.id === draft.topicId)
    : undefined;
  if (draft.topicId && !linkedTopic)
    return { accepted: false, reason: "stale_topic" };
  return {
    accepted: true,
    draft: {
      title,
      subject: linkedTopic?.subject ?? subject,
      ...(draft.topicId ? { topicId: draft.topicId } : {}),
      keyIdeas,
    },
  };
}

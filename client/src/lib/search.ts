import type { StudyState } from "./types";

export type GlobalSearchResult = {
  kind:
    | "Task"
    | "Study session"
    | "Flashcard"
    | "Note"
    | "Goal"
    | "Exam"
    | "Timetable"
    | "Quiz"
    | "Study material"
    | "Revision plan"
    | "Topic"
    | "Saved lesson";
  title: string;
  sub: string;
  route: string;
};

type SearchRecord = GlobalSearchResult & { order: number };

const link = (path: string, key: string, value: string) =>
  `${path}?${key}=${encodeURIComponent(value)}`;

/** Returns the first twelve workspace records matching a student's query, ordered by title relevance. */
export function getGlobalSearchResults(
  state: StudyState,
  query: string
): GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  let order = 0;
  const records: SearchRecord[] = [
    ...state.tasks.map(task => ({
      kind: "Task" as const,
      title: task.title,
      sub: task.subject,
      route: link("/tasks", "taskId", task.id),
      order: order++,
    })),
    ...state.sessions.map(session => ({
      kind: "Study session" as const,
      title: `${session.subject} — ${session.topic}`,
      sub: session.date,
      route: link("/study", "sessionId", session.id),
      order: order++,
    })),
    ...state.decks.flatMap(deck =>
      deck.cards.map(card => ({
        kind: "Flashcard" as const,
        title: card.front,
        sub: deck.name,
        route: link("/flashcards", "cardId", card.id),
        order: order++,
      }))
    ),
    ...state.notes.map(note => ({
      kind: "Note" as const,
      title: note.title,
      sub: note.subject,
      route: link("/notes", "noteId", note.id),
      order: order++,
    })),
    ...state.goals.map(goal => ({
      kind: "Goal" as const,
      title: goal.name,
      sub: `${goal.current}/${goal.target} ${goal.unit}`,
      route: link("/goals", "goalId", goal.id),
      order: order++,
    })),
    ...state.exams.map(exam => ({
      kind: "Exam" as const,
      title: `${exam.subject} — ${exam.name}`,
      sub: exam.date,
      route: link("/exams", "examId", exam.id),
      order: order++,
    })),
    ...state.events.map(event => ({
      kind: "Timetable" as const,
      title: event.title,
      sub: event.subject || `Day ${event.day + 1}`,
      route: link("/timetable", "eventId", event.id),
      order: order++,
    })),
    ...state.quizzes.map(quiz => ({
      kind: "Quiz" as const,
      title: quiz.title,
      sub: `${quiz.subject}${quiz.topic ? ` — ${quiz.topic}` : ""}`,
      route: link("/quizzes", "quizId", quiz.id),
      order: order++,
    })),
    ...state.studyMaterials.map(material => ({
      kind: "Study material" as const,
      title: material.title,
      sub: material.subject,
      route: link("/materials", "materialId", material.id),
      order: order++,
    })),
    ...state.studyPlans.map(plan => ({
      kind: "Revision plan" as const,
      title: plan.title,
      sub: `${plan.items.filter(item => item.status === "planned").length} planned item${plan.items.filter(item => item.status === "planned").length === 1 ? "" : "s"}`,
      route: link("/study", "planId", plan.id),
      order: order++,
    })),
    ...state.topics.map(topic => ({
      kind: "Topic" as const,
      title: topic.name,
      sub: topic.subject,
      route: link("/mastery", "topicId", topic.id),
      order: order++,
    })),
    ...state.savedLessons.map(lesson => ({
      kind: "Saved lesson" as const,
      title: lesson.title,
      sub: `${lesson.subject} · ${lesson.topic}`,
      route: link("/saved", "lessonId", lesson.id),
      order: order++,
    })),
  ];

  const score = (record: SearchRecord) => {
    const title = record.title.toLowerCase();
    const sub = record.sub.toLowerCase();
    if (title === q) return 400;
    if (title.startsWith(q)) return 300;
    if (title.includes(q)) return 200;
    if (sub.startsWith(q)) return 120;
    return 100;
  };

  return records
    .filter(
      record =>
        record.title.toLowerCase().includes(q) ||
        record.sub.toLowerCase().includes(q)
    )
    .sort((a, b) => score(b) - score(a) || a.order - b.order)
    .slice(0, 12)
    .map(({ order: _order, ...record }) => record);
}

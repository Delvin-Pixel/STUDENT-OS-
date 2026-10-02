import type { QuizQuestion, StudyQuiz } from "./types";

export type NewQuiz = Omit<StudyQuiz, "id" | "createdAt" | "questions"> & {
  questions: Array<Omit<QuizQuestion, "id">>;
};

const QUIZ_SOURCES: readonly StudyQuiz["source"][] = ["manual", "ai_draft"];
const QUESTION_TYPES: readonly QuizQuestion["type"][] = [
  "multiple_choice",
  "true_false",
];

/** Produces the bounded, canonical text form for a learner-reviewed quiz draft. */
export function normalizeNewQuiz(quiz: NewQuiz): NewQuiz {
  return {
    ...quiz,
    title: quiz.title.trim(),
    subject: quiz.subject.trim(),
    topic: quiz.topic.trim(),
    questions: quiz.questions.map(question => ({
      ...question,
      prompt: question.prompt.trim(),
      options: question.options.map(option => option.trim()),
      explanation: question.explanation.trim(),
    })),
  };
}

/** Mirrors canonical workspace quiz bounds before an optimistic local write. */
export function validateNewQuiz(quiz: NewQuiz): string | null {
  if (!quiz.title.trim() || quiz.title.trim().length > 1_000)
    return "Give the quiz a title of up to 1,000 characters.";
  if (!quiz.subject.trim() || quiz.subject.trim().length > 1_000)
    return "Choose a subject of up to 1,000 characters.";
  if (quiz.topic.trim().length > 1_000)
    return "Keep the quiz topic to 1,000 characters or fewer.";
  if (!QUIZ_SOURCES.includes(quiz.source)) return "Choose a valid quiz source.";
  if (
    !Array.isArray(quiz.questions) ||
    quiz.questions.length < 1 ||
    quiz.questions.length > 100
  )
    return "A quiz needs between 1 and 100 questions.";

  for (const question of quiz.questions) {
    if (!question.prompt.trim() || question.prompt.trim().length > 20_000)
      return "Every question needs a prompt of up to 20,000 characters.";
    if (!QUESTION_TYPES.includes(question.type))
      return "Every question must use a supported format.";
    if (
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      question.options.length > 6
    )
      return "Every question needs between 2 and 6 answer options.";
    if (
      question.options.some(
        option => !option.trim() || option.trim().length > 1_000
      )
    )
      return "Every answer option needs text of up to 1,000 characters.";
    if (
      !Number.isInteger(question.correctOptionIndex) ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex >= question.options.length
    )
      return "Choose a correct answer from each question’s listed options.";
    if (question.explanation.trim().length > 20_000)
      return "Keep each explanation to 20,000 characters or fewer.";
  }

  return null;
}

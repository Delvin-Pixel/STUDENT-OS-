import type { QuizAttemptResponse, StudyQuiz } from "./types";

export function normalizeQuizAnswers(
  quiz: StudyQuiz,
  answers: Record<string, number>
): Record<string, number> | null {
  const normalized: Record<string, number> = {};
  for (const question of quiz.questions) {
    const answer = answers[question.id];
    if (
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= question.options.length
    )
      return null;
    normalized[question.id] = answer;
  }
  return normalized;
}

export function scoreQuiz(quiz: StudyQuiz, answers: Record<string, number>) {
  const correctCount = quiz.questions.filter(
    question => answers[question.id] === question.correctOptionIndex
  ).length;
  return {
    correctCount,
    questionCount: quiz.questions.length,
    score: Math.round((correctCount / quiz.questions.length) * 100),
    missedQuestionIds: quiz.questions
      .filter(question => answers[question.id] !== question.correctOptionIndex)
      .map(question => question.id),
  };
}

export function buildQuizAttemptResponses(
  quiz: StudyQuiz,
  answers: Record<string, number>
): QuizAttemptResponse[] {
  return quiz.questions.map(question => {
    const selectedOptionIndex = answers[question.id];
    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionIndex,
      correctOptionIndex: question.correctOptionIndex,
      correct: selectedOptionIndex === question.correctOptionIndex,
      explanation: question.explanation,
      ...(question.subtopic ? { subtopic: question.subtopic } : {}),
    };
  });
}

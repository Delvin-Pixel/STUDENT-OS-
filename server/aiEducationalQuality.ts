/**
 * Deterministic pedagogical-quality guardrails for AI-generated learning content.
 * These checks do not prove factual correctness; they reject clear structural and
 * instructional-quality failures before content can be trusted by the app.
 */

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter(token => token.length >= 4);
}

function overlap(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  let hits = 0;
  for (const token of left) if (right.has(token)) hits += 1;
  return hits;
}

export function validateQuizEducationalQuality(draft: {
  questions: Array<{
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    difficulty?: "easy" | "medium" | "hard";
  }>;
}) {
  if (draft.questions.length !== 50) {
    throw new Error("Quiz must contain exactly 50 questions.");
  }

  let questionsWithDifficulty = 0;
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };

  for (const question of draft.questions) {
    const correct = question.options[question.correctOptionIndex];
    if (!correct)
      throw new Error(
        "Quiz contains a question without a valid correct answer."
      );

    if (question.prompt.trim().length < 12) {
      throw new Error(
        "Quiz contains a question prompt that is too short to be instructional."
      );
    }
    if (question.explanation.trim().length < 20) {
      throw new Error(
        "Quiz contains an explanation that is too short to teach the concept."
      );
    }

    const explanationOverlap = Math.max(
      overlap(question.prompt, question.explanation),
      overlap(correct, question.explanation)
    );
    if (explanationOverlap === 0) {
      throw new Error(
        "Quiz contains an explanation that is disconnected from its question and answer."
      );
    }

    if (question.difficulty) {
      questionsWithDifficulty += 1;
      difficultyCounts[question.difficulty] += 1;
    }
  }

  // If the model chose to label difficulty, require genuine variation.
  if (questionsWithDifficulty >= 45) {
    const activeLevels = Object.values(difficultyCounts).filter(
      count => count > 0
    ).length;
    if (activeLevels < 2) {
      throw new Error(
        "Quiz difficulty labels do not provide meaningful variation."
      );
    }
  }
}

export function validateLessonEducationalQuality(lesson: {
  learningGoals: string[];
  sections: Array<{ heading: string; explanation: string }>;
  keyTerms: Array<{ term: string; definition: string }>;
  workedExample: { prompt: string; solution: string };
  diagram: { nodes: string[]; connectors: string[] };
  quickCheck: { question: string; answer: string };
}) {
  const sectionText = lesson.sections
    .map(section => `${section.heading}\n${section.explanation}`)
    .join("\n");

  if (!lesson.learningGoals.some(goal => overlap(goal, sectionText) > 0)) {
    throw new Error(
      "Lesson learning goals are not reflected in the instructional sections."
    );
  }

  for (const term of lesson.keyTerms) {
    if (normalize(term.definition) === normalize(term.term)) {
      throw new Error(
        "Lesson contains a key term whose definition only repeats the term."
      );
    }
    if (term.definition.trim().length < 12) {
      throw new Error(
        "Lesson contains a key-term definition that is too short to teach meaningfully."
      );
    }
  }

  if (
    normalize(lesson.workedExample.prompt) ===
    normalize(lesson.workedExample.solution)
  ) {
    throw new Error(
      "Lesson worked example repeats the prompt instead of providing a solution."
    );
  }
  if (lesson.workedExample.solution.trim().length < 25) {
    throw new Error(
      "Lesson worked example solution is too short to demonstrate reasoning."
    );
  }
  if (
    overlap(lesson.workedExample.prompt, lesson.workedExample.solution) === 0
  ) {
    throw new Error(
      "Lesson worked example solution is disconnected from its prompt."
    );
  }

  if (lesson.quickCheck.answer.trim().length < 8) {
    throw new Error(
      "Lesson quick-check answer is too short to establish understanding."
    );
  }
  if (
    normalize(lesson.quickCheck.question) ===
    normalize(lesson.quickCheck.answer)
  ) {
    throw new Error("Lesson quick-check answer simply repeats the question.");
  }

  if (
    lesson.diagram.nodes.length === 0 &&
    lesson.diagram.connectors.length > 0
  ) {
    throw new Error("Lesson diagram contains connectors without nodes.");
  }
  if (
    lesson.diagram.nodes.length >= 2 &&
    lesson.diagram.connectors.length !== lesson.diagram.nodes.length - 1
  ) {
    throw new Error(
      "Lesson diagram connectors do not match the node sequence."
    );
  }
}

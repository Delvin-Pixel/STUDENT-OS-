import { z } from "zod";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "into",
  "about",
  "what",
  "when",
  "where",
  "which",
  "how",
  "why",
  "are",
  "was",
  "were",
  "will",
  "would",
  "should",
  "could",
  "can",
  "has",
  "have",
  "had",
  "its",
  "their",
  "them",
  "then",
  "than",
  "also",
  "only",
  "using",
  "use",
  "used",
  "learn",
  "lesson",
  "topic",
]);

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
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token));
}

function phrasePresent(text: string, phrase: string): boolean {
  const p = normalize(phrase);
  return p.length > 0 && normalize(text).includes(p);
}

function enoughTokenOverlap(text: string, phrase: string): boolean {
  const wanted = tokens(phrase);
  if (wanted.length === 0) return false;
  const actual = new Set(tokens(text));
  const hits = wanted.filter(token => actual.has(token)).length;
  return hits >= Math.max(1, Math.ceil(wanted.length * 0.5));
}

/**
 * Deterministic context guardrails. These checks do not claim to prove that AI
 * content is factually correct; they only prevent strong context drift and bad
 * references from becoming trusted application state.
 */
export function validateLearningContextAlignment(params: {
  outputText: string;
  subject: string;
  topic: string;
  educationLevel?: string;
  label: string;
}) {
  const { outputText, subject, topic, educationLevel, label } = params;
  const normalized = normalize(outputText);
  if (!normalized)
    throw new Error(`${label} returned no usable semantic content.`);

  const subjectCovered =
    phrasePresent(normalized, subject) ||
    enoughTokenOverlap(normalized, subject);
  const topicCovered =
    phrasePresent(normalized, topic) || enoughTokenOverlap(normalized, topic);
  if (!subjectCovered || !topicCovered) {
    throw new Error(
      `${label} did not stay aligned with the requested subject/topic.`
    );
  }

  // Only reject explicit, unmistakable level claims that contradict the request.
  if (educationLevel) {
    const levelFamily = (level: string) => {
      const value = normalize(level);
      if (/primary|elementary/.test(value)) return "primary";
      if (/middle|junior high|jhs/.test(value)) return "middle";
      if (/secondary|senior high|shs|high school/.test(value))
        return "secondary";
      if (/university|college|undergraduate|tertiary/.test(value))
        return "tertiary";
      if (/postgraduate|graduate|masters|doctor/.test(value))
        return "postgraduate";
      return "unknown";
    };
    const requested = levelFamily(educationLevel);
    const explicitClaimRegex =
      /(primary school|elementary school|middle school|junior high|senior high|high school|undergraduate|university|college|postgraduate|graduate student)/g;
    for (const match of normalized.matchAll(explicitClaimRegex)) {
      const claimed = levelFamily(match[0]);
      if (
        requested !== "unknown" &&
        claimed !== "unknown" &&
        claimed !== requested
      ) {
        throw new Error(
          `${label} contains an explicit education-level mismatch.`
        );
      }
    }
  }
}

export function validateQuizSemanticIntegrity(
  draft: {
    title: string;
    instructions: string;
    questions: Array<{ prompt: string; subtopic?: string }>;
  },
  context: { subject: string; topic: string; educationLevel: string }
) {
  const searchable = [
    draft.title,
    draft.instructions,
    ...draft.questions.map(
      question => `${question.prompt} ${question.subtopic || ""}`
    ),
  ].join("\n");
  validateLearningContextAlignment({
    ...context,
    outputText: searchable,
    label: "Quiz draft",
  });
}

export function validateScheduleSemanticIntegrity<
  T extends {
    subject: string;
    topic: string;
    deadlineTitle: string;
  },
>(
  draft: { sessions: T[] },
  input: { deadlines: Array<{ subject: string; title: string }> }
) {
  for (const session of draft.sessions) {
    const match = input.deadlines.some(
      deadline =>
        normalize(deadline.title) === normalize(session.deadlineTitle) &&
        normalize(deadline.subject) === normalize(session.subject)
    );
    if (!match) {
      throw new Error(
        "Schedule draft references a deadline/subject pair that was not supplied."
      );
    }
    if (!session.topic.trim())
      throw new Error("Schedule draft contains an empty topic.");
  }
}

export function validateLessonSemanticIntegrity(
  value: unknown,
  context: { subject: string; topic: string; educationLevel: string }
) {
  const lesson = z.record(z.string(), z.unknown()).parse(value);
  const text = Object.values(lesson)
    .filter(value => typeof value === "string")
    .join("\n");
  validateLearningContextAlignment({
    ...context,
    outputText: text,
    label: "Lesson output",
  });
}

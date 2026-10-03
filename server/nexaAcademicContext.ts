import {
  getKnowledgeGaps,
  getRankedNextActions,
  getTopicMastery,
} from "@/lib/learningIntelligence";
import type { StudyState } from "@/lib/types";
import type { CanonicalStudyState } from "@shared/workspaceSchema";
import type { NexaAcademicContext } from "./nexaProvider";

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bounded(value: string, max = 1_100) {
  return value.trim().slice(0, max);
}

function asLearningIntelligenceState(state: CanonicalStudyState) {
  // The workspace is already validated by the shared canonical schema. This
  // conversion lets the server invoke the exact deterministic engine used by
  // the client without accepting any unvalidated browser-provided state.
  return state as unknown as StudyState;
}

export function buildStudentOsNexaAcademicContext(
  canonicalState: CanonicalStudyState,
  question: string,
  snapshotId?: string | null,
  today = new Date().toISOString().slice(0, 10)
): NexaAcademicContext | undefined {
  const state = asLearningIntelligenceState(canonicalState);
  const mastery = getTopicMastery(state, today);
  const normalizedQuestion = normalize(question);

  const topic = mastery
    .filter(entry => {
      const name = normalize(entry.topic);
      return name.length >= 3 && normalizedQuestion.includes(name);
    })
    .sort((a, b) => b.topic.length - a.topic.length)[0];

  const personalized =
    /\b(?:my|me|i|progress|next|study plan|schedule|today|tomorrow|exam|weak|strong|mastery|ready|focus|revise|revision|practice)\b/i.test(
      question
    );

  const evidence: string[] = [];
  const constraints: string[] = [
    "Student OS learningIntelligence is authoritative. Do not create or change mastery, readiness, prerequisite, remediation, transition, or next-best-action decisions.",
  ];

  if (topic) {
    evidence.push(
      bounded(`Canonical topic: ${topic.subject} — ${topic.topic}.`)
    );
    evidence.push(
      bounded(
        `Canonical mastery ${topic.score}/100; readiness ${topic.readiness}/100; confidence ${topic.confidence}/100; evidence records ${topic.evidenceCount}; direct evidence ${topic.directEvidenceCount}; signal ${topic.estimated ? "estimated" : "evidence-backed"}.`
      )
    );
    evidence.push(
      bounded(
        `Freshness ${topic.freshness}/100; exam pressure ${topic.examPressure}/100.`
      )
    );

    const gaps = getKnowledgeGaps(state, topic.topicId, today).slice(0, 2);
    for (const gap of gaps) {
      evidence.push(
        bounded(
          `Canonical knowledge gap: ${gap.subject} — ${gap.topic}; kind ${gap.kind}; severity ${gap.severity}; mastery ${gap.mastery}/100; confidence ${gap.confidence}/100. ${gap.reason}`
        )
      );
    }
    constraints.push(
      "Use the canonical topic numbers only as supplied evidence; do not infer a replacement score or promote/demote the learner."
    );
  }

  if (personalized) {
    const actions = getRankedNextActions(state, today).slice(0, 2);
    for (const [index, action] of actions.entries()) {
      evidence.push(
        bounded(
          `Student OS next-best action ${index + 1}: ${action.title}; duration ${action.duration} minutes; route ${action.route}; reason: ${action.reason}`
        )
      );
    }
    if (actions.length) {
      constraints.push(
        "Do not re-rank or replace Student OS next-best actions; explain or coach around the supplied ordering."
      );
    }
  }

  if (!evidence.length) return undefined;

  const normalizedSnapshot = snapshotId?.trim().slice(0, 128) || null;
  return Object.freeze({
    authority: "student-os-learning-intelligence",
    snapshotId: normalizedSnapshot,
    evidence: Object.freeze(evidence.slice(0, 16)),
    constraints: Object.freeze(constraints.slice(0, 12)),
  });
}

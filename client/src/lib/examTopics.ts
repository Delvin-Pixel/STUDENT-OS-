import type { StudyState } from "./types";

function hasLinkedLearningArtifact(state: StudyState, topicId: string) {
  return (
    state.tasks.some(item => item.topicId === topicId) ||
    state.sessions.some(item => item.topicId === topicId) ||
    state.learningEvidence.some(item => item.topicId === topicId) ||
    state.studyPlans.some(plan =>
      plan.items.some(item => item.topicId === topicId)
    ) ||
    state.quizzes.some(item => item.topicId === topicId) ||
    state.quizAttempts.some(item => item.topicId === topicId) ||
    state.studyMaterials.some(item => item.topicId === topicId) ||
    state.decks.some(item => item.topicId === topicId) ||
    state.focusSessions.some(item => item.topicId === topicId) ||
    state.notes.some(item => item.topicId === topicId)
  );
}

/**
 * Detaches a topic from one exam without destroying its learning history.
 * Exam topics are promoted to the canonical topic list only if the detached
 * identifier is still referenced and is not already retained by another exam.
 */
export function detachExamTopic(
  state: StudyState,
  examId: string,
  topicId: string,
  timestamp: string
): StudyState {
  const exam = state.exams.find(candidate => candidate.id === examId);
  const topic = exam?.topics.find(candidate => candidate.id === topicId);
  if (!exam || !topic) return state;

  const exams = state.exams.map(candidate =>
    candidate.id === examId
      ? {
          ...candidate,
          topics: candidate.topics.filter(
            candidateTopic => candidateTopic.id !== topicId
          ),
        }
      : candidate
  );
  const retainedElsewhere =
    state.topics.some(candidate => candidate.id === topicId) ||
    state.exams.some(
      candidate =>
        candidate.id !== examId &&
        candidate.topics.some(candidateTopic => candidateTopic.id === topicId)
    );

  if (retainedElsewhere || !hasLinkedLearningArtifact(state, topicId))
    return { ...state, exams };

  return {
    ...state,
    exams,
    topics: [
      ...state.topics,
      {
        id: topic.id,
        subject: exam.subject,
        name: topic.name,
        source: "exam",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

/** Removes an exam after retaining any of its topic identities still needed by learner data. */
export function removeExamPreservingTopics(
  state: StudyState,
  examId: string,
  timestamp: string
): StudyState {
  const exam = state.exams.find(candidate => candidate.id === examId);
  if (!exam) return state;

  const detached = exam.topics.reduce(
    (next, topic) => detachExamTopic(next, examId, topic.id, timestamp),
    state
  );
  return {
    ...detached,
    exams: detached.exams.filter(candidate => candidate.id !== examId),
  };
}

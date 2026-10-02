import type {
  AcademicStage,
  FoundationCheck,
  Profile,
  QuizAttemptResponse,
  StudyQuiz,
  StudyState,
} from "./types";

const DAY_MS = 86_400_000;
const DEFAULT_INTERVAL_DAYS = 21;
const STRONG_INTERVAL_DAYS = 45;
const WEAK_INTERVAL_DAYS = 7;

function normalize(value?: string) {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function previousClassLevel(
  stage: AcademicStage,
  classLevel?: string
): string | undefined {
  const value = normalize(classLevel);
  const match = value.match(/^(JHS|SHS) ?([1-6])$/);
  if (match) {
    const n = Number(match[2]);
    return n > 1 ? `${match[1]} ${n - 1}` : undefined;
  }
  const primary = value.match(/^PRIMARY ?([1-6])$/);
  if (stage === "Primary" && primary) {
    const n = Number(primary[1]);
    return n > 1 ? `Primary ${n - 1}` : undefined;
  }
  const level = value.match(/^LEVEL ?([1-6]00)$/);
  if (stage === "Tertiary" && level) {
    const n = Number(level[1]);
    return n > 100 ? `Level ${n - 100}` : undefined;
  }
  return undefined;
}

export function foundationSourceStage(
  stage: AcademicStage,
  classLevel?: string
): AcademicStage | undefined {
  const previous = previousClassLevel(stage, classLevel);
  if (!previous) return undefined;
  if (/^JHS/.test(previous)) return "JHS";
  if (/^SHS/.test(previous)) return "SHS";
  if (/^PRIMARY/.test(previous)) return "Primary";
  if (/^LEVEL/.test(previous)) return "Tertiary";
  return undefined;
}

function checkKey(
  subject: string,
  stage: AcademicStage,
  currentClassLevel: string
) {
  return `${normalize(subject)}::${stage}::${normalize(currentClassLevel)}`;
}

function dueStatus(nextDueAt: string, lastScore?: number, now = new Date()) {
  if (!nextDueAt || new Date(nextDueAt).getTime() <= now.getTime())
    return "due" as const;
  return typeof lastScore === "number" && lastScore < 70
    ? ("due" as const)
    : ("completed" as const);
}

type FoundationTarget = {
  topicId: string;
  concept: string;
  priority: number;
  reason: string;
};

/**
 * Selects specific historical concepts when the knowledge graph has explicit
 * academic-level tags. Untagged topics are deliberately excluded so Foundation
 * Monitor never mistakes a current-level topic for an old-level concept.
 */
export function selectFoundationTargets(
  check: FoundationCheck,
  state: Pick<StudyState, "topics" | "learningEvidence">,
  limit = 5
): FoundationTarget[] {
  const source = normalize(check.sourceClassLevel);
  const current = normalize(check.currentClassLevel);
  const subject = normalize(check.subject);

  const sourceTopics = state.topics.filter(
    topic =>
      normalize(topic.subject) === subject &&
      normalize(topic.academicClassLevel) === source
  );
  if (!sourceTopics.length) return [];

  const currentTopics = state.topics.filter(
    topic =>
      normalize(topic.subject) === subject &&
      normalize(topic.academicClassLevel) === current
  );
  const prerequisiteIds = new Set(
    currentTopics.flatMap(topic => topic.prerequisiteTopicIds ?? [])
  );

  const evidenceByTopic = new Map<string, typeof state.learningEvidence>();
  for (const evidence of state.learningEvidence) {
    const list = evidenceByTopic.get(evidence.topicId) ?? [];
    list.push(evidence);
    evidenceByTopic.set(evidence.topicId, list);
  }

  const now = Date.now();
  const ranked = sourceTopics.map(topic => {
    const evidence = [...(evidenceByTopic.get(topic.id) ?? [])]
      .filter(item => typeof item.score === "number")
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
    const latest = evidence[0];
    const score = latest?.score;
    const ageDays = latest
      ? Math.max(0, (now - new Date(latest.recordedAt).getTime()) / DAY_MS)
      : Infinity;

    let priority = 20;
    let reason = "important prior-level concept";
    if (prerequisiteIds.has(topic.id)) {
      priority += 50;
      reason = "prerequisite of current-level learning";
    }
    if (typeof score !== "number") {
      priority += 25;
      reason = `${reason}; no direct evidence yet`;
    } else if (score < 70) {
      priority += 45;
      reason = `${reason}; latest evidence was below 70%`;
    } else if (score < 85) {
      priority += 20;
      reason = `${reason}; latest evidence needs reinforcement`;
    }
    if (ageDays > 45) priority += 15;
    else if (ageDays > 21) priority += 8;

    return {
      topicId: topic.id,
      concept: topic.name,
      priority,
      reason,
    };
  });

  return ranked
    .sort(
      (a, b) => b.priority - a.priority || a.concept.localeCompare(b.concept)
    )
    .slice(0, Math.max(1, Math.min(10, limit)));
}

export function ensureFoundationChecks(
  profile: Profile,
  existing: FoundationCheck[] = [],
  now = new Date()
): FoundationCheck[] {
  const currentStage =
    profile.educationLevel === "Lower Secondary"
      ? "JHS"
      : profile.educationLevel === "Secondary" ||
          profile.educationLevel === "Sixth Form / College"
        ? "SHS"
        : profile.educationLevel === "Primary"
          ? "Primary"
          : profile.educationLevel === "Tertiary"
            ? "Tertiary"
            : "Other";
  const currentClassLevel = profile.classLevel?.trim();
  const previous = previousClassLevel(currentStage, currentClassLevel);
  const sourceStage = foundationSourceStage(currentStage, currentClassLevel);
  if (
    !currentClassLevel ||
    !previous ||
    !sourceStage ||
    !profile.subjects.length
  )
    return existing;

  const updated = [...existing];
  for (const subject of profile.subjects.slice(0, 30)) {
    const key = checkKey(subject, currentStage, currentClassLevel);
    const found = updated.find(
      item =>
        checkKey(item.subject, item.currentStage, item.currentClassLevel) ===
        key
    );
    if (found) continue;
    updated.push({
      id: `foundation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject,
      sourceStage,
      sourceClassLevel: previous,
      currentStage,
      currentClassLevel,
      status: "due",
      createdAt: now.toISOString(),
      nextDueAt: now.toISOString(),
      attemptCount: 0,
      rationale: `Occasionally verify ${previous} foundations so current ${currentClassLevel} learning is built on reliable knowledge.`,
      focusTopicIds: [],
      focusConcepts: [],
      attentionStatus: "none",
      weakConcepts: [],
      remediationTopicIds: [],
      remediationAttemptCount: 0,
    });
  }
  return updated.slice(-500).map(item => ({
    ...item,
    status: dueStatus(item.nextDueAt, item.lastScore, now),
  }));
}

export function dueFoundationChecks(
  state: StudyState,
  now = new Date()
): FoundationCheck[] {
  if (!state.profile) return [];
  const checks = ensureFoundationChecks(
    state.profile,
    state.foundationChecks ?? [],
    now
  );
  return checks
    .filter(check => check.status === "due")
    .map(check => {
      const targets = selectFoundationTargets(check, state);
      return {
        ...check,
        focusTopicIds: targets.map(target => target.topicId),
        focusConcepts: targets.map(target => target.concept),
        ...(targets.length
          ? {
              rationale: `${check.rationale} Targets: ${targets.map(target => target.concept).join(", ")}.`,
            }
          : {}),
      };
    });
}

export function analyzeFoundationResponses(
  check: FoundationCheck,
  responses: QuizAttemptResponse[],
  score: number
): Pick<
  FoundationCheck,
  | "attentionStatus"
  | "weakConcepts"
  | "remediationTopicIds"
  | "lastOutcomeSummary"
> {
  const weakConcepts = responses
    .filter(response => !response.correct)
    .map(response => response.subtopic?.trim() || "General foundation")
    .filter(
      (value, index, all) =>
        all.findIndex(
          candidate => normalize(candidate) === normalize(value)
        ) === index
    )
    .slice(0, 8);

  const targetPairs = (check.focusTopicIds ?? []).map((topicId, index) => ({
    topicId,
    concept: check.focusConcepts?.[index],
  }));
  const remediationTopicIds = targetPairs
    .filter(
      pair =>
        pair.concept &&
        weakConcepts.some(weak => normalize(weak) === normalize(pair.concept!))
    )
    .map(pair => pair.topicId);

  const attentionStatus =
    score < 70 ? "needs_remediation" : score < 85 ? "ready_to_recheck" : "none";
  const summary =
    score < 70
      ? `Foundation gap detected. Fresh misses concentrated around ${weakConcepts.slice(0, 3).join(", ") || "the checked foundation"}. A small remediation pass should come before the next verification.`
      : score < 85
        ? `Foundation is usable but not fully secure. ${weakConcepts.length ? `Reinforce ${weakConcepts.slice(0, 3).join(", ")} before the next recheck.` : "Keep the foundation warm with a later fresh recheck."}`
        : `Foundation looks strong on this check. Keep it monitored and verify again later with fresh questions.`;

  return {
    attentionStatus,
    weakConcepts,
    remediationTopicIds,
    lastOutcomeSummary: summary,
  };
}

function scheduleForScore(score: number) {
  if (score < 70) return WEAK_INTERVAL_DAYS;
  if (score >= 85) return STRONG_INTERVAL_DAYS;
  return DEFAULT_INTERVAL_DAYS;
}

export function markFoundationAssessment(
  check: FoundationCheck,
  score: number,
  now = new Date(),
  responses: QuizAttemptResponse[] = []
): FoundationCheck {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const analysis = analyzeFoundationResponses(
    check,
    responses,
    normalizedScore
  );
  const intervalDays = scheduleForScore(normalizedScore);
  return {
    ...check,
    status: "completed",
    lastAssessedAt: now.toISOString(),
    lastScore: normalizedScore,
    attemptCount: check.attemptCount + 1,
    nextDueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    ...analysis,
    remediationAttemptCount: check.remediationAttemptCount ?? 0,
  };
}

export function markFoundationRemediation(
  check: FoundationCheck,
  score: number,
  now = new Date(),
  responses: QuizAttemptResponse[] = []
): FoundationCheck {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const analysis = analyzeFoundationResponses(
    check,
    responses,
    normalizedScore
  );
  const resolved = normalizedScore >= 85;
  return {
    ...check,
    status: "completed",
    lastAssessedAt: now.toISOString(),
    lastScore: normalizedScore,
    nextDueAt: new Date(
      now.getTime() +
        (resolved ? STRONG_INTERVAL_DAYS : WEAK_INTERVAL_DAYS) * DAY_MS
    ).toISOString(),
    attentionStatus: resolved
      ? "none"
      : normalizedScore >= 70
        ? "ready_to_recheck"
        : "needs_remediation",
    weakConcepts: resolved ? [] : analysis.weakConcepts,
    remediationTopicIds: resolved
      ? []
      : analysis.remediationTopicIds?.length
        ? analysis.remediationTopicIds
        : (check.remediationTopicIds ?? check.focusTopicIds ?? []),
    remediationAttemptCount: (check.remediationAttemptCount ?? 0) + 1,
    lastOutcomeSummary: resolved
      ? "The targeted foundation repair check is strong enough to close the immediate gap. Student OS will continue monitoring it later."
      : analysis.lastOutcomeSummary,
    lastRemediationAt: now.toISOString(),
  };
}

export function foundationRemediationContext(check: FoundationCheck) {
  return [
    "This is a short Student OS foundation remediation pass.",
    `Current level: ${check.currentClassLevel}.`,
    `Foundation level: ${check.sourceClassLevel}.`,
    `Subject: ${check.subject}.`,
    `Target only the concepts that showed weakness: ${(check.weakConcepts ?? check.focusConcepts ?? []).join(", ") || "the checked foundation"}.`,
    "Use concise explanation-first practice, then fresh verification. Do not frame this as a class-placement test.",
  ].join(" ");
}

export function foundationRemediationQuizMetadata(
  check: FoundationCheck
): Pick<
  StudyQuiz,
  | "assessmentKind"
  | "foundationSourceStage"
  | "foundationSourceClassLevel"
  | "currentAcademicClassLevel"
> {
  return {
    assessmentKind: "foundation_remediation",
    foundationSourceStage: check.sourceStage,
    foundationSourceClassLevel: check.sourceClassLevel,
    currentAcademicClassLevel: check.currentClassLevel,
  };
}

export function foundationAssessmentContext(check: FoundationCheck) {
  return [
    `This is a Student OS foundation check, not a level-change assessment.`,
    `Current level: ${check.currentClassLevel}.`,
    `Foundation level to verify: ${check.sourceClassLevel}.`,
    `Subject: ${check.subject}.`,
    `Generate questions that verify important prerequisite concepts from the foundation level.`,
    check.focusConcepts?.length
      ? `Prioritize these diagnostic concepts: ${check.focusConcepts.join(", ")}.`
      : `No concept-level targets are available; use a concise subject-level diagnostic.`,
    `Do not assume the learner is a beginner; favor concise diagnostic coverage and application.`,
  ].join(" ");
}

export function foundationQuizMetadata(
  check: FoundationCheck
): Pick<
  StudyQuiz,
  | "assessmentKind"
  | "foundationSourceStage"
  | "foundationSourceClassLevel"
  | "currentAcademicClassLevel"
> {
  return {
    assessmentKind: "foundation",
    foundationSourceStage: check.sourceStage,
    foundationSourceClassLevel: check.sourceClassLevel,
    currentAcademicClassLevel: check.currentClassLevel,
  };
}

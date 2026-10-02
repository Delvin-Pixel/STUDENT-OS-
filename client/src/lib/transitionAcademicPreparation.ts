import type {
  AcademicStage,
  FoundationCheck,
  StudyState,
  TransitionDecisionHub,
  TransitionRecommendation,
} from "./types";

export type AcademicPreparationKind =
  "foundation_remediation" | "foundation_recheck" | "academic_review";

export interface TransitionAcademicPreparation {
  id: string;
  title: string;
  description: string;
  kind: AcademicPreparationKind;
  priority: "high" | "medium" | "low";
  subject: string;
  topicId?: string;
  concept?: string;
  optionId?: string;
  optionName?: string;
  foundationCheckId?: string;
  sourceRef: string;
}

function normalize(value?: string): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function matchingFoundationChecks(
  state: StudyState,
  subject: string
): FoundationCheck[] {
  const target = normalize(subject);
  return (state.foundationChecks ?? [])
    .filter(check => normalize(check.subject) === target)
    .sort((a, b) => {
      const urgency = (check: FoundationCheck) =>
        check.attentionStatus === "needs_remediation"
          ? 3
          : check.attentionStatus === "ready_to_recheck"
            ? 2
            : check.status === "due"
              ? 1
              : 0;
      return urgency(b) - urgency(a);
    });
}

function foundationTopicId(
  check: FoundationCheck,
  state: StudyState
): string | undefined {
  const candidates = [
    ...(check.remediationTopicIds ?? []),
    ...(check.focusTopicIds ?? []),
  ];
  return candidates.find(id => state.topics.some(topic => topic.id === id));
}

function foundationConcept(check: FoundationCheck): string | undefined {
  return (
    (check.weakConcepts?.[0] ?? check.focusConcepts?.[0])?.trim() || undefined
  );
}

function actionForCheck(
  stage: AcademicStage,
  check: FoundationCheck,
  state: StudyState,
  option?: TransitionRecommendation,
  optionName?: string
): TransitionAcademicPreparation {
  const remediation = check.attentionStatus === "needs_remediation";
  const recheck = check.attentionStatus === "ready_to_recheck";
  const concept = foundationConcept(check);
  const topicId = foundationTopicId(check, state);
  const optionSuffix = optionName ? ` for ${optionName}` : "";
  const sourceRef = `transition-prep:foundation:${check.id}`;

  return {
    id: sourceRef.replace(/^transition-prep:/, ""),
    title: remediation
      ? `Repair ${check.subject} foundation${optionSuffix}`
      : recheck
        ? `Recheck ${check.subject} foundation${optionSuffix}`
        : `Review ${check.subject} foundation${optionSuffix}`,
    description: remediation
      ? `${concept ? `Target ${concept} and the other localized weak concepts. ` : "Target the localized weak concepts. "}This is academic preparation that strengthens your knowledge; it does not erase or change a recorded result or guarantee eligibility.`
      : recheck
        ? `${concept ? `Revisit ${concept} first, then complete a fresh foundation check. ` : "Complete a fresh foundation recheck. "}Use the result as learning evidence before relying on this subject in your transition plan.`
        : `Refresh ${check.sourceClassLevel} ${check.subject} foundations before the ${stage === "SHS" ? "post-SHS" : "next-stage"} decision. Student OS keeps this separate from admission eligibility.`,
    kind: remediation
      ? "foundation_remediation"
      : recheck
        ? "foundation_recheck"
        : "academic_review",
    priority: remediation ? "high" : recheck ? "medium" : "low",
    subject: check.subject,
    topicId,
    concept,
    optionId: option?.optionId,
    optionName,
    foundationCheckId: check.id,
    sourceRef,
  };
}

/**
 * Bridges transition requirements into the learner's existing academic evidence loop.
 * It never treats remediation as proof of admission eligibility; it creates study work
 * that can strengthen a prerequisite concept and feed later fresh evidence.
 */
export function getTransitionAcademicPreparation(
  stage: AcademicStage,
  hub: TransitionDecisionHub,
  ranked: TransitionRecommendation[],
  state: StudyState,
  limit = 6
): TransitionAcademicPreparation[] {
  const byOptionId = new Map(hub.options.map(option => [option.id, option]));
  const results = new Map(
    hub.results
      .filter(result => result.subject.trim() && result.grade.trim())
      .map(result => [normalize(result.subject), result])
  );
  const candidates: TransitionAcademicPreparation[] = [];

  for (const rankedOption of ranked) {
    const option = byOptionId.get(rankedOption.optionId);
    if (!option) continue;
    if (
      rankedOption.fitBand === "borderline_fit" ||
      rankedOption.fitBand === "stronger_fit" ||
      rankedOption.fitBand === "possible_fit"
    ) {
      // A good fit can still benefit from prerequisite maintenance. Only surface it
      // when an existing foundation signal justifies the work.
    }

    for (const required of option.requiredSubjects) {
      const hasResult = results.has(normalize(required.subject));
      if (!hasResult) continue;

      const checks = matchingFoundationChecks(state, required.subject);
      const active = checks.find(
        check =>
          check.attentionStatus === "needs_remediation" ||
          check.attentionStatus === "ready_to_recheck" ||
          check.status === "due"
      );
      if (!active) continue;

      candidates.push(
        actionForCheck(stage, active, state, rankedOption, option.name)
      );
    }
  }

  // If there are no option-specific signals, still surface the strongest foundation
  // issue so transition planning can improve the same evidence that drives study planning.
  if (!candidates.length) {
    const checks = (state.foundationChecks ?? [])
      .filter(
        check =>
          check.attentionStatus === "needs_remediation" ||
          check.attentionStatus === "ready_to_recheck"
      )
      .sort(
        (a, b) =>
          (a.attentionStatus === "needs_remediation" ? -1 : 1) -
          (b.attentionStatus === "needs_remediation" ? -1 : 1)
      );
    candidates.push(
      ...checks
        .slice(0, limit)
        .map(check => actionForCheck(stage, check, state))
    );
  }

  const deduped: TransitionAcademicPreparation[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    if (seen.has(item.sourceRef)) continue;
    seen.add(item.sourceRef);
    deduped.push(item);
    if (deduped.length >= Math.max(1, Math.min(10, limit))) break;
  }

  return deduped;
}

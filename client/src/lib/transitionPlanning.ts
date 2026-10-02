import {
  hasVerifiedOfficialTransitionSource,
  type TransitionSourceAttestation,
} from "./transitionDecision";
import type {
  AcademicStage,
  TransitionDecisionHub,
  TransitionRecommendation,
} from "./types";

export type TransitionReadiness =
  "exploring" | "evidence_needed" | "decision_ready";
export type TransitionActionPriority = "high" | "medium" | "low";

export interface TransitionNextAction {
  id: string;
  title: string;
  description: string;
  priority: TransitionActionPriority;
  sourceRef: string;
}

function stageLabel(stage: AcademicStage): string {
  return stage === "JHS"
    ? "SHS"
    : stage === "SHS"
      ? "tertiary"
      : "your next academic stage";
}

function action(
  sourceRef: string,
  title: string,
  description: string,
  priority: TransitionActionPriority
): TransitionNextAction {
  return {
    id: sourceRef.replace(/^transition-action:/, ""),
    title,
    description,
    priority,
    sourceRef,
  };
}

export function getTransitionReadiness(
  hub: TransitionDecisionHub,
  ranked: TransitionRecommendation[],
  attestations: readonly TransitionSourceAttestation[] = []
): { status: TransitionReadiness; title: string; detail: string } {
  if (!hub.options.length) {
    return {
      status: "exploring",
      title: "Still exploring",
      detail:
        "Add the schools, programmes or courses you are seriously considering so Student OS can compare them transparently.",
    };
  }

  const hasResults = hub.results.some(result => result.grade.trim());
  const evidenceIncomplete =
    ranked.some(item => item.fitBand === "insufficient_evidence") ||
    hub.options.some(
      option =>
        !hasVerifiedOfficialTransitionSource(
          option,
          attestations.find(attestation => attestation.optionId === option.id)
        )
    );
  const allHaveRequirementsGap =
    ranked.length > 0 &&
    ranked.every(item => item.fitBand === "requirements_gap");

  if (!hasResults || evidenceIncomplete || allHaveRequirementsGap) {
    return {
      status: "evidence_needed",
      title: "More evidence needed",
      detail: !hasResults
        ? "Capture the results you actually have before treating an option as a fit."
        : allHaveRequirementsGap
          ? "The stored requirements currently show a gap for every saved option; review requirements or add alternatives before choosing a path."
          : "Some stored requirements or result evidence still need verification before the comparison is decision-ready.",
    };
  }

  return {
    status: "decision_ready",
    title: "Decision-ready planning",
    detail: `Student OS has enough entered evidence to compare your options for ${stageLabel(hub.sourceStage)}. This is planning support, not an admission guarantee.`,
  };
}

export function getTransitionNextActions(
  stage: AcademicStage,
  hub: TransitionDecisionHub,
  ranked: TransitionRecommendation[]
): TransitionNextAction[] {
  const actions: TransitionNextAction[] = [];
  const hasResults = hub.results.some(result => result.grade.trim());
  const missingResults = new Set<string>();

  for (const option of hub.options) {
    for (const required of option.requiredSubjects) {
      if (
        !hub.results.some(
          result =>
            result.grade.trim() &&
            result.subject.trim().toLowerCase() ===
              required.subject.trim().toLowerCase()
        )
      ) {
        missingResults.add(required.subject.trim());
      }
    }
  }

  if (!hasResults) {
    actions.push(
      action(
        "transition-action:capture-results",
        stage === "JHS"
          ? "Capture your BECE results"
          : stage === "SHS"
            ? "Capture your WASSCE results"
            : "Capture the results relevant to your next step",
        "Enter only verified results you actually have. Missing grades stay missing until you supply them.",
        "high"
      )
    );
  } else if (missingResults.size) {
    actions.push(
      action(
        "transition-action:fill-result-gaps",
        "Fill the result gaps affecting your options",
        `${missingResults.size} required subject result${missingResults.size === 1 ? " is" : "s are"} still missing across your saved options.`,
        "high"
      )
    );
  }

  if (!hub.options.length) {
    actions.push(
      action(
        "transition-action:add-options",
        "Add 2–3 realistic options",
        "Include the programmes, schools or courses you would genuinely consider so the comparison is useful rather than theoretical.",
        "high"
      )
    );
  }

  const needsVerification = ranked.find(
    item => item.fitBand === "insufficient_evidence"
  );
  if (needsVerification) {
    actions.push(
      action(
        `transition-action:verify:${needsVerification.optionId}`,
        "Verify the strongest unresolved option",
        "Attach the current official requirement source before relying on the comparison.",
        "high"
      )
    );
  }

  const gap = ranked.find(item => item.fitBand === "requirements_gap");
  if (gap) {
    actions.push(
      action(
        `transition-action:review-gap:${gap.optionId}`,
        "Review your requirement gap",
        "Use the stored reasons to see whether a requirement needs verification, a different option is better, or more preparation is needed.",
        "medium"
      )
    );
  }

  if (
    hub.options.length &&
    ranked.some(
      item => item.fitBand === "stronger_fit" || item.fitBand === "possible_fit"
    )
  ) {
    actions.push(
      action(
        "transition-action:build-timeline",
        stage === "JHS"
          ? "Build your SHS preparation timeline"
          : stage === "SHS"
            ? "Build your post-SHS application timeline"
            : "Build your next-step preparation timeline",
        "Turn the decision into concrete dates, documents, requirement checks and study tasks inside the main task system.",
        "medium"
      )
    );
  }

  return actions.slice(0, 5);
}

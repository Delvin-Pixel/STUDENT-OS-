/** Transition decision engine (B46/B47). Workspace validation lives only in shared/workspaceSchema.ts. */
import type {
  GradeResult,
  TransitionDecisionHub,
  TransitionDecisionOption,
} from "./types";

export const WASSCE_GRADE_POINTS: Record<string, number> = {
  A1: 1,
  B2: 2,
  B3: 3,
  C4: 4,
  C5: 5,
  C6: 6,
  D7: 7,
  E8: 8,
  F9: 9,
};

const NORMALIZED_GRADE = new Map(
  Object.entries(WASSCE_GRADE_POINTS).map(([grade, points]) => [
    grade.replace(/\s+/g, "").toUpperCase(),
    points,
  ])
);

function normalizeSubject(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function resultBySubject(results: GradeResult[]): Map<string, GradeResult> {
  const map = new Map<string, GradeResult>();
  for (const result of results) {
    if (
      !result.subject.trim() ||
      !NORMALIZED_GRADE.has(result.grade.replace(/\s+/g, "").toUpperCase())
    )
      continue;
    map.set(normalizeSubject(result.subject), result);
  }
  return map;
}

function gradePoint(result?: GradeResult): number | undefined {
  if (!result) return undefined;
  return NORMALIZED_GRADE.get(result.grade.replace(/\s+/g, "").toUpperCase());
}

function pickNamed(
  map: Map<string, GradeResult>,
  names: string[]
): GradeResult | undefined {
  for (const name of names) {
    const direct = map.get(normalizeSubject(name));
    if (direct) return direct;
  }
  return undefined;
}

export function calculateWassceAggregate(
  results: GradeResult[],
  track: "science" | "non_science" | "best_six"
): { aggregate: number; subjects: GradeResult[] } | null {
  const valid = results.filter(
    result => gradePoint(result) !== undefined && result.subject.trim()
  );
  const uniqueBySubject = resultBySubject(valid);
  const uniqueValid = [...uniqueBySubject.values()];
  if (uniqueValid.length < 6) return null;
  const map = uniqueBySubject;
  let selected: GradeResult[];

  if (track === "best_six") {
    selected = [...uniqueValid]
      .sort((a, b) => gradePoint(a)! - gradePoint(b)!)
      .slice(0, 6);
  } else {
    const core =
      track === "science"
        ? ["English", "Core Mathematics", "Integrated Science"]
        : ["English", "Core Mathematics", "Social Studies"];
    const coreResults = core
      .map(name => pickNamed(map, [name]))
      .filter(Boolean) as GradeResult[];
    const electives = uniqueValid
      .filter(
        item =>
          item.category === "elective" &&
          !core.some(
            name => normalizeSubject(name) === normalizeSubject(item.subject)
          )
      )
      .sort((a, b) => gradePoint(a)! - gradePoint(b)!)
      .slice(0, 3);
    if (coreResults.length !== 3 || electives.length !== 3) return null;
    selected = [...coreResults, ...electives];
  }

  if (new Set(selected.map(item => item.id)).size !== 6) return null;
  return {
    aggregate: selected.reduce((sum, item) => sum + gradePoint(item)!, 0),
    subjects: selected,
  };
}

export interface TransitionSourceAttestation {
  optionId: string;
  sourceUrl: string;
  level: "official" | "verified_secondary";
  verifiedAt: string;
  verifierVersion: string;
}

/**
 * Workspace fields are learner-controlled and never establish privileged
 * provenance. Trust requires a separate server-owned attestation that is not
 * part of synchronized StudyState.
 */
export function hasVerifiedOfficialTransitionSource(
  option: TransitionDecisionOption,
  attestation?: TransitionSourceAttestation
): boolean {
  if (!attestation || attestation.level !== "official") return false;
  if (option.id !== attestation.optionId || !option.sourceUrl) return false;
  try {
    return (
      new URL(option.sourceUrl).protocol === "https:" &&
      new URL(attestation.sourceUrl).protocol === "https:" &&
      option.sourceUrl === attestation.sourceUrl &&
      Number.isFinite(Date.parse(attestation.verifiedAt)) &&
      Boolean(attestation.verifierVersion.trim())
    );
  } catch {
    return false;
  }
}

export function evaluateOption(
  option: TransitionDecisionOption,
  results: GradeResult[],
  aggregate?: number,
  attestation?: TransitionSourceAttestation
): TransitionDecisionOption {
  const bySubject = resultBySubject(results);
  const reasons: string[] = [];
  const officialSourceVerified = hasVerifiedOfficialTransitionSource(
    option,
    attestation
  );
  let needsReview = option.confidence !== "official" || !officialSourceVerified;
  if (!officialSourceVerified) {
    reasons.push("Source provenance has not been verified by Student OS.");
  }
  for (const required of option.requiredSubjects) {
    const result = bySubject.get(normalizeSubject(required.subject));
    if (!result) {
      reasons.push(`Missing result for ${required.subject}.`);
      needsReview = true;
      continue;
    }
    if (required.minimumGrade) {
      const actual = gradePoint(result);
      const minimum = NORMALIZED_GRADE.get(
        required.minimumGrade.replace(/\s+/g, "").toUpperCase()
      );
      if (actual === undefined || minimum === undefined) {
        reasons.push(`Grade rule for ${required.subject} needs verification.`);
        needsReview = true;
      } else if (actual > minimum) {
        reasons.push(
          `${required.subject}: ${result.grade} is below the stored minimum ${required.minimumGrade}.`
        );
      }
    }
  }
  if (option.maxAggregate !== undefined) {
    if (aggregate === undefined) {
      reasons.push(
        "Aggregate requirement cannot be assessed from the current results."
      );
      needsReview = true;
    } else if (aggregate > option.maxAggregate) {
      reasons.push(
        `Aggregate ${aggregate} is above the stored maximum of ${option.maxAggregate}.`
      );
    }
  }
  const hasHardFailure = reasons.some(reason =>
    /below the stored minimum|above the stored maximum/.test(reason)
  );
  return {
    ...option,
    eligibility: hasHardFailure
      ? "needs_review"
      : needsReview
        ? "needs_review"
        : "meets_stated_requirements",
    eligibilityReasons: reasons.length
      ? reasons
      : ["All stored requirements currently match the entered results."],
  };
}

export function evaluateTransitionOptions(
  hub: TransitionDecisionHub
): TransitionDecisionHub {
  return {
    ...hub,
    status: hub.results.some(result => result.grade)
      ? "results_captured"
      : "preparing",
    options: hub.options.map(option =>
      evaluateOption(option, hub.results, hub.aggregate)
    ),
  };
}

export function getDefaultTransitionHub(
  sourceStage: import("./types").AcademicStage
): TransitionDecisionHub {
  const preparationTasks =
    sourceStage === "JHS"
      ? [
          {
            id: "transition-prep-results",
            title: "Record your final BECE results when available",
            done: false,
          },
          {
            id: "transition-prep-options",
            title: "Shortlist SHS choices",
            done: false,
          },
          {
            id: "transition-prep-rules",
            title: "Verify current placement or school-entry rules",
            done: false,
          },
          {
            id: "transition-prep-docs",
            title: "Gather the documents needed for admission",
            done: false,
          },
        ]
      : sourceStage === "SHS"
        ? [
            {
              id: "transition-prep-results",
              title: "Record your final WASSCE results",
              done: false,
            },
            {
              id: "transition-prep-options",
              title: "Shortlist schools and programmes",
              done: false,
            },
            {
              id: "transition-prep-rules",
              title: "Verify each institution's current requirements",
              done: false,
            },
            {
              id: "transition-prep-docs",
              title: "Gather application documents and deadlines",
              done: false,
            },
            {
              id: "transition-prep-plan",
              title: "Create a post-SHS application timeline",
              done: false,
            },
          ]
        : [
            {
              id: "transition-prep-results",
              title: "Record the results relevant to your next step",
              done: false,
            },
            {
              id: "transition-prep-options",
              title: "Shortlist your next academic options",
              done: false,
            },
            {
              id: "transition-prep-rules",
              title: "Verify current entry requirements",
              done: false,
            },
            {
              id: "transition-prep-docs",
              title: "Gather required documents and dates",
              done: false,
            },
          ];

  return {
    sourceStage,
    targetStage:
      sourceStage === "JHS"
        ? "SHS"
        : sourceStage === "SHS"
          ? "Tertiary"
          : undefined,
    status: "preparing",
    results: [],
    options: [],
    preparationTasks,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function getTransitionHeadline(
  stage: import("./types").AcademicStage
): string {
  if (stage === "JHS") return "Prepare for your SHS chapter";
  if (stage === "SHS") return "Prepare for life after SHS";
  if (stage === "Tertiary") return "Plan your next academic chapter";
  return "Prepare for your next academic chapter";
}

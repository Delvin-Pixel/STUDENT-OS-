import {
  hasVerifiedOfficialTransitionSource,
  WASSCE_GRADE_POINTS,
} from "./transitionDecision";
import type {
  GradeResult,
  TransitionDecisionOption,
  TransitionFitBand,
  TransitionRecommendation,
} from "./types";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}
function point(grade?: string) {
  return grade
    ? WASSCE_GRADE_POINTS[grade.replace(/\s+/g, "").toUpperCase()]
    : undefined;
}

/**
 * Produces a transparent planning band, never an admission probability.
 * Lower WASSCE aggregate is better, so aggregate headroom improves the fit score.
 */
export function rankTransitionOptions(
  options: TransitionDecisionOption[],
  results: GradeResult[],
  aggregate?: number
): TransitionRecommendation[] {
  const resultMap = new Map(
    results.map(result => [normalize(result.subject), result])
  );
  return options
    .map(option => {
      const reasons: string[] = [];
      let score = 50;
      let missing = 0;
      let hardGap = false;

      for (const required of option.requiredSubjects) {
        const result = resultMap.get(normalize(required.subject));
        if (!result) {
          missing++;
          continue;
        }
        if (required.minimumGrade) {
          const actual = point(result.grade);
          const minimum = point(required.minimumGrade);
          if (actual !== undefined && minimum !== undefined) {
            if (actual <= minimum) score += 8;
            else {
              score -= 30;
              hardGap = true;
              reasons.push(`${required.subject} is below the stored minimum.`);
            }
          }
        } else score += 3;
      }
      if (missing) {
        score -= Math.min(25, missing * 8);
        reasons.push(
          `${missing} required subject result${missing === 1 ? " is" : "s are"} missing.`
        );
      }

      if (option.maxAggregate !== undefined) {
        if (aggregate === undefined) score -= 12;
        else if (aggregate <= option.maxAggregate) {
          const margin = option.maxAggregate - aggregate;
          score += Math.min(20, margin * 4);
          reasons.push(
            `Aggregate is ${margin} point${margin === 1 ? "" : "s"} inside the stored maximum.`
          );
        } else {
          score -= 30;
          hardGap = true;
          reasons.push("Aggregate is above the stored maximum.");
        }
      }

      if (hasVerifiedOfficialTransitionSource(option)) score += 5;
      else score -= 8;
      score = Math.max(0, Math.min(100, score));

      const fitBand: TransitionFitBand = hardGap
        ? "requirements_gap"
        : missing ||
            (aggregate === undefined && option.maxAggregate !== undefined)
          ? "insufficient_evidence"
          : score >= 78
            ? "stronger_fit"
            : score >= 62
              ? "possible_fit"
              : "borderline_fit";

      if (!reasons.length)
        reasons.push(
          "Stored requirements currently align with the entered results."
        );
      return {
        optionId: option.id,
        fitBand,
        score,
        reasons,
        caution:
          "Planning band only — not an admission probability or guarantee. Re-check the institution/placement authority's current rules before applying.",
      };
    })
    .sort((a, b) => b.score - a.score);
}

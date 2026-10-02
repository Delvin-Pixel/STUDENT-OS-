import type { AcademicStage } from "./types";

export type TransitionRuleConfidence =
  "official" | "verified_secondary" | "unverified";

export interface TransitionRulePack {
  id: string;
  version: string;
  countryCode: string;
  from: AcademicStage;
  to: AcademicStage;
  title: string;
  confidence: TransitionRuleConfidence;
  sourceLabel: string;
  sourceUrl?: string;
  verifiedAt?: string;
  aggregate: {
    kind: "wassce_six_subject" | "none";
    note: string;
  };
  notes: string[];
}

/**
 * Versioned rules are deliberately separate from decision logic. Updating a
 * government/exam rule therefore does not require rewriting the engine.
 * This baseline contains only rules Student OS can safely state without
 * inventing BECE placement formulas.
 */
export const GHANA_TRANSITION_RULE_PACKS: readonly TransitionRulePack[] = [
  {
    id: "gh-jhs-shs",
    version: "2026.1",
    countryCode: "GH",
    from: "JHS",
    to: "SHS",
    title: "Ghana JHS → SHS transition",
    confidence: "unverified",
    sourceLabel: "WAEC / CSSPS rules must be verified for the active cycle",
    aggregate: {
      kind: "none",
      note: "Do not label a BECE aggregate as official until the active placement rules explicitly define it.",
    },
    notes: [
      "Capture BECE results without inventing an aggregate formula.",
      "Keep school/programme eligibility tied to the active placement cycle.",
    ],
  },
  {
    id: "gh-shs-tertiary",
    version: "2026.1",
    countryCode: "GH",
    from: "SHS",
    to: "Tertiary",
    title: "Ghana SHS → tertiary transition",
    confidence: "unverified",
    sourceLabel:
      "Institution-published admission requirements must be re-verified per cycle",
    aggregate: {
      kind: "wassce_six_subject",
      note: "Student OS may calculate a planning aggregate from entered WASSCE grades; the institution's published method remains authoritative.",
    },
    notes: [
      "Eligibility is based only on requirements stored with a source and the learner's entered results.",
      "An eligibility match is not an admission guarantee.",
    ],
  },
];

export function getTransitionRulePack(
  from: AcademicStage,
  to?: AcademicStage,
  countryCode = "GH"
): TransitionRulePack | undefined {
  const target =
    to ?? (from === "JHS" ? "SHS" : from === "SHS" ? "Tertiary" : undefined);
  if (!target) return undefined;
  return GHANA_TRANSITION_RULE_PACKS.find(
    pack =>
      pack.countryCode === countryCode &&
      pack.from === from &&
      pack.to === target
  );
}

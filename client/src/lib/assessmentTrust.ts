import type { LearningEvidence } from "./types";
import { daysBetween, todayStr } from "./utils";

export type EvidenceTrustLabel = "strong" | "moderate" | "weak" | "rejected";

export type EvidenceTrust = {
  weight: number;
  label: EvidenceTrustLabel;
  reason: string;
};

function day(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function validScore(score: unknown): score is number {
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 100
  );
}

/**
 * Rates how much an evidence record should contribute to mastery. This is a
 * trust signal, not a claim about the learner's ability. Repeated use of the
 * same assessment source on the same day is intentionally discounted so that
 * retries cannot inflate mastery merely through repetition.
 */
export function getEvidenceTrust(
  evidence: LearningEvidence,
  allEvidence: LearningEvidence[] = [evidence],
  today = todayStr()
): EvidenceTrust {
  if (!evidence.id || !evidence.topicId) {
    return {
      weight: 0,
      label: "rejected",
      reason: "The evidence record is missing a canonical identity.",
    };
  }

  const isDirect = evidence.kind === "quiz" || evidence.kind === "practice";
  const hasScore = validScore(evidence.score);
  if (isDirect && !hasScore) {
    return {
      weight: 0,
      label: "rejected",
      reason:
        "A direct assessment needs a valid 0–100 score before it can affect mastery.",
    };
  }

  if (evidence.kind === "study_session") {
    const minutes = evidence.minutes ?? 0;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return {
        weight: 0,
        label: "rejected",
        reason:
          "A study-session record without valid minutes cannot add mastery evidence.",
      };
    }
    return {
      weight: 0.25,
      label: "weak",
      reason:
        "Study time is useful context but is intentionally weak evidence of mastery.",
    };
  }

  if (evidence.kind === "flashcard" && !hasScore) {
    return {
      weight: 0,
      label: "rejected",
      reason:
        "Flashcard evidence needs a valid score to be used as performance evidence.",
    };
  }

  let weight = isDirect ? 1 : 0.65;
  let label: EvidenceTrustLabel = isDirect ? "strong" : "moderate";
  let reason = isDirect
    ? "Direct quiz/practice performance is strong evidence when it is valid and sufficiently novel."
    : "Flashcard performance is useful supporting evidence but is weighted below direct assessment.";

  if (!evidence.sourceId && isDirect) {
    weight *= 0.85;
    label = "moderate";
    reason =
      "The score is valid, but the assessment source is not identifiable, so trust is slightly reduced.";
  }

  // A later retry must not retroactively discount the original attempt. Use
  // chronological order, with stable input order for equal timestamps.
  const currentIndex = allEvidence.findIndex(entry => entry.id === evidence.id);
  const sourcePeers = evidence.sourceId
    ? allEvidence.filter(
        (entry, index) =>
          entry.id !== evidence.id &&
          entry.topicId === evidence.topicId &&
          entry.sourceId === evidence.sourceId &&
          (entry.recordedAt < evidence.recordedAt ||
            (entry.recordedAt === evidence.recordedAt &&
              (currentIndex < 0 || index < currentIndex)))
      )
    : [];
  const sameDayPeers = sourcePeers.filter(
    entry => day(entry.recordedAt) === day(evidence.recordedAt)
  );
  if (sameDayPeers.length > 0) {
    weight *= 0.2;
    label = "weak";
    reason =
      "This assessment source was already attempted on the same day; the retry is heavily discounted to prevent mastery inflation.";
  } else if (sourcePeers.length > 0) {
    const latestPeer = sourcePeers
      .map(entry => day(entry.recordedAt))
      .sort()
      .at(-1);
    if (latestPeer) {
      const spacing = Math.abs(
        daysBetween(latestPeer, day(evidence.recordedAt))
      );
      if (spacing < 2) {
        weight *= 0.45;
        label = "moderate";
        reason =
          "The same assessment source was repeated very recently, so this result receives reduced novelty credit.";
      }
    }
  }

  // Old evidence can remain useful, but freshness is already handled by the
  // mastery recency multiplier. Do not double-penalize it here.
  void today;
  return { weight: Math.max(0, Math.min(1, weight)), label, reason };
}

export type EvidenceQualitySummary = {
  total: number;
  strong: number;
  moderate: number;
  weak: number;
  rejected: number;
  trustedDirectCount: number;
  trustScore: number;
};

export function getEvidenceQualitySummary(
  evidence: LearningEvidence[],
  today = todayStr()
): EvidenceQualitySummary {
  const counts = { strong: 0, moderate: 0, weak: 0, rejected: 0 };
  let weighted = 0;
  let trustedDirectCount = 0;
  for (const entry of evidence) {
    const trust = getEvidenceTrust(entry, evidence, today);
    counts[trust.label] += 1;
    weighted += trust.weight;
    if (
      (entry.kind === "quiz" || entry.kind === "practice") &&
      trust.weight >= 0.5
    )
      trustedDirectCount += 1;
  }
  return {
    total: evidence.length,
    ...counts,
    trustedDirectCount,
    trustScore: evidence.length
      ? Math.round((weighted / evidence.length) * 100)
      : 0,
  };
}

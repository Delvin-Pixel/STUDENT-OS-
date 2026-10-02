import type {
  AcademicJourney,
  AcademicJourneyRecord,
  AcademicStage,
  EducationLevel,
  Profile,
} from "./types";

const SCHOOL_YEAR_PATTERN = /^(\d{4})(?:[/-](\d{2,4}))?$/;

export function academicStageFor(level: EducationLevel): AcademicStage {
  switch (level) {
    case "Primary":
      return "Primary";
    case "Lower Secondary":
      return "JHS";
    case "Secondary":
      return "SHS";
    case "Sixth Form / College":
      return "SHS";
    case "Tertiary":
      return "Tertiary";
    default:
      return "Other";
  }
}

export function nextAcademicStage(
  stage: AcademicStage
): AcademicStage | undefined {
  switch (stage) {
    case "Primary":
      return "JHS";
    case "JHS":
      return "SHS";
    case "SHS":
      return "Tertiary";
    default:
      return undefined;
  }
}

export function academicYearForNow(date = new Date()): string {
  const year = date.getFullYear();
  return `${year}/${String(year + 1).slice(-2)}`;
}

function startYearOf(academicYear?: string): number | undefined {
  if (!academicYear) return undefined;
  const match = academicYear.trim().match(SCHOOL_YEAR_PATTERN);
  return match ? Number(match[1]) : undefined;
}

export function expectedCompletionYearFor(
  stage: AcademicStage,
  classLevel: string | undefined,
  academicYear: string
): number | undefined {
  const startYear = startYearOf(academicYear);
  if (!startYear) return undefined;
  const normalized = (classLevel ?? "").trim().toUpperCase();
  const match = normalized.match(/(?:JHS|SHS)\s*([1-6])/);
  if (match) {
    const classNumber = Number(match[1]);
    const terminal = stage === "JHS" ? 3 : stage === "SHS" ? 3 : undefined;
    if (terminal !== undefined && classNumber <= terminal)
      return startYear + (terminal - classNumber) + 1;
  }
  const level = normalized.match(/(?:LEVEL|L)\s*(\d+)/);
  if (stage === "Tertiary" && level) {
    const n = Number(level[1]);
    if (n >= 100) return startYear + Math.max(1, Math.ceil((400 - n) / 100));
  }
  if (stage === "Primary" && normalized.match(/(?:PRIMARY|P)\s*([1-6])/)) {
    const n = Number(normalized.match(/(?:PRIMARY|P)\s*([1-6])/)?.[1]);
    return startYear + Math.max(1, 6 - n + 1);
  }
  return undefined;
}

function classIsTerminal(stage: AcademicStage, classLevel?: string): boolean {
  const value = (classLevel ?? "").trim().toUpperCase();
  if (stage === "JHS") return /(?:JHS\s*3|JUNIOR\s*HIGH\s*3)/.test(value);
  if (stage === "SHS") return /(?:SHS\s*3|SENIOR\s*HIGH\s*3)/.test(value);
  return false;
}

export function createAcademicJourney(
  profile: Profile,
  now = new Date()
): AcademicJourney {
  const stage = academicStageFor(profile.educationLevel);
  const academicYear = profile.academicYear ?? academicYearForNow(now);
  const expectedCompletionYear = expectedCompletionYearFor(
    stage,
    profile.classLevel,
    academicYear
  );
  const next = nextAcademicStage(stage);
  const record: AcademicJourneyRecord = {
    stage,
    ...(profile.classLevel ? { classLevel: profile.classLevel } : {}),
    academicYear,
    ...(expectedCompletionYear ? { expectedCompletionYear } : {}),
    ...(next ? { expectedNextStage: next } : {}),
    status: classIsTerminal(stage, profile.classLevel)
      ? "approaching_graduation"
      : "current",
    detectedAt: now.toISOString(),
  };
  return { current: record, history: [] };
}

export function evaluateAcademicJourney(
  journey: AcademicJourney,
  now = new Date()
): AcademicJourney {
  const current = journey.current;
  if (current.status === "completed" || current.status === "transitioning")
    return journey;
  const approachingByClass = classIsTerminal(current.stage, current.classLevel);
  const completionReached =
    typeof current.expectedCompletionYear === "number" &&
    now.getFullYear() >= current.expectedCompletionYear;
  const shouldApproach = approachingByClass || completionReached;
  const expectedNext = current.expectedNextStage;
  if (!shouldApproach || !expectedNext)
    return { ...journey, current: { ...current, status: "current" } };
  if (!completionReached)
    return {
      ...journey,
      current: {
        ...current,
        status: "approaching_graduation",
        detectedAt: now.toISOString(),
      },
      transition: journey.transition ?? {
        from: current.stage,
        to: expectedNext,
        status: "preparing",
        startedAt: now.toISOString(),
      },
    };
  return {
    ...journey,
    current: {
      ...current,
      status: "awaiting_confirmation",
      detectedAt: now.toISOString(),
    },
    transition: journey.transition
      ? { ...journey.transition, status: "awaiting_confirmation" }
      : {
          from: current.stage,
          to: expectedNext,
          status: "awaiting_confirmation",
          startedAt: now.toISOString(),
        },
  };
}

export function confirmGraduationAndTransition(
  journey: AcademicJourney,
  nextProfile: Profile,
  now = new Date()
): AcademicJourney {
  const nextStage = academicStageFor(nextProfile.educationLevel);
  const completed: AcademicJourneyRecord = {
    ...journey.current,
    status: "completed",
    graduationConfirmedAt: now.toISOString(),
    completedAt: now.toISOString(),
  };
  const next: AcademicJourneyRecord = {
    stage: nextStage,
    ...(nextProfile.classLevel ? { classLevel: nextProfile.classLevel } : {}),
    academicYear: nextProfile.academicYear ?? academicYearForNow(now),
    ...(expectedCompletionYearFor(
      nextStage,
      nextProfile.classLevel,
      nextProfile.academicYear ?? academicYearForNow(now)
    )
      ? {
          expectedCompletionYear: expectedCompletionYearFor(
            nextStage,
            nextProfile.classLevel,
            nextProfile.academicYear ?? academicYearForNow(now)
          ),
        }
      : {}),
    ...(nextAcademicStage(nextStage)
      ? { expectedNextStage: nextAcademicStage(nextStage) }
      : {}),
    status: "transitioning",
    detectedAt: now.toISOString(),
  };
  return {
    current: next,
    history: [...journey.history, completed].slice(-20),
    transition: {
      from: journey.current.stage,
      to: nextStage,
      status: "confirmed",
      startedAt: journey.transition?.startedAt ?? now.toISOString(),
      confirmedAt: now.toISOString(),
    },
  };
}

export function stageLabel(stage: AcademicStage): string {
  return stage === "JHS"
    ? "Junior High School"
    : stage === "SHS"
      ? "Senior High School"
      : stage === "Tertiary"
        ? "Tertiary / University"
        : stage;
}

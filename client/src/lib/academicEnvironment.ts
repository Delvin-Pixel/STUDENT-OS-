import { academicStageFor } from "./academicJourney";
import type { AcademicStage, EducationLevel, Profile } from "./types";

export type AcademicEnvironment = {
  stage: AcademicStage;
  level: EducationLevel;
  classLevel: string;
  academicYear?: string;
  track?: string;
  selectionKind: "subject" | "course";
  label: string;
  focus: string;
  assessmentLabel: string;
  transitionLabel?: string;
  progression: "foundation" | "developing" | "terminal" | "tertiary" | "other";
  curriculumDepth: "foundation" | "standard" | "advanced";
};

function progressionFor(
  stage: AcademicStage,
  classLevel: string
): AcademicEnvironment["progression"] {
  const value = classLevel.trim().toUpperCase();
  if (stage === "JHS") return value.includes("3") ? "terminal" : "developing";
  if (stage === "SHS") return value.includes("3") ? "terminal" : "developing";
  if (stage === "Primary")
    return value.includes("6") ? "terminal" : "foundation";
  if (stage === "Tertiary") return "tertiary";
  return "other";
}

function depthFor(
  stage: AcademicStage,
  classLevel: string
): AcademicEnvironment["curriculumDepth"] {
  const progression = progressionFor(stage, classLevel);
  if (stage === "Primary") return "foundation";
  if (progression === "terminal" || stage === "Tertiary") return "advanced";
  return "standard";
}

export function getAcademicEnvironment(profile: Profile): AcademicEnvironment {
  const stage = academicStageFor(profile.educationLevel);
  const classLevel = profile.classLevel?.trim() || "Not specified";
  const progression = progressionFor(stage, classLevel);
  const common = {
    stage,
    level: profile.educationLevel,
    classLevel,
    academicYear: profile.academicYear,
    track: profile.academicTrack,
    selectionKind:
      profile.academicSelectionKind ??
      (profile.educationLevel === "Tertiary" ? "course" : "subject"),
    progression,
    curriculumDepth: depthFor(stage, classLevel),
  } as const;

  if (stage === "JHS")
    return {
      ...common,
      label: `JHS · ${classLevel}`,
      focus:
        progression === "terminal"
          ? "Finish the JHS curriculum and prepare for the next academic stage."
          : "Build strong foundations across the JHS curriculum.",
      assessmentLabel: "JHS assessments & BECE preparation",
      transitionLabel: "SHS preparation",
    };
  if (stage === "SHS")
    return {
      ...common,
      label: `SHS · ${classLevel}${profile.academicTrack ? ` · ${profile.academicTrack}` : ""}`,
      focus:
        progression === "terminal"
          ? "Consolidate the SHS curriculum and prepare for WASSCE and the next stage."
          : "Build depth in your SHS programme and subjects.",
      assessmentLabel: "Class assessments & WASSCE preparation",
      transitionLabel: "Tertiary preparation",
    };
  if (stage === "Tertiary")
    return {
      ...common,
      label: `Tertiary · ${classLevel}${profile.academicTrack ? ` · ${profile.academicTrack}` : ""}`,
      focus:
        "Master your courses, manage academic workload and build evidence of university-level learning.",
      assessmentLabel: "Course assessments & examinations",
    };
  if (stage === "Primary")
    return {
      ...common,
      label: `Primary · ${classLevel}`,
      focus: "Build core literacy, numeracy and learning foundations.",
      assessmentLabel: "Class assessments",
    };
  return {
    ...common,
    label: `${profile.educationLevel} · ${classLevel}`,
    focus: "Student OS will adapt as more academic context is provided.",
    assessmentLabel: "Academic assessments",
  };
}

export function academicEnvironmentKey(profile: Profile): string {
  const environment = getAcademicEnvironment(profile);
  return [
    environment.stage,
    environment.level,
    environment.classLevel,
    environment.academicYear ?? "",
    environment.track ?? "",
    environment.selectionKind,
    profile.subjects.join("|"),
  ]
    .join("::")
    .toLocaleLowerCase();
}

import type { EducationLevel } from "./types";

export type AcademicSelectionKind = "subject" | "course";

export type AcademicOfferingGroup = {
  title: string;
  offerings: readonly string[];
};

export type AcademicOfferings = {
  kind: AcademicSelectionKind;
  selectionLabel: "subject" | "course";
  pluralLabel: "subjects" | "courses";
  heading: string;
  supportingText: string;
  customLabel: string;
  customHint: string;
  groups: readonly AcademicOfferingGroup[];
  /** Generic curated choices are a selection aid, never a claim about one institution's official catalogue. */
  provenance: "curated-generic" | "school-subject";
};

const SCHOOL_OFFERINGS: readonly AcademicOfferingGroup[] = [
  {
    title: "Core subjects",
    offerings: [
      "Mathematics",
      "English Language",
      "Integrated Science",
      "Social Studies",
      "Computing",
    ],
  },
  {
    title: "Additional subjects",
    offerings: [
      "Biology",
      "Chemistry",
      "Physics",
      "Economics",
      "Geography",
      "History",
      "Business Studies",
      "Visual Arts",
      "Music",
      "French",
    ],
  },
];

/**
 * Broad degree-programme areas commonly represented in undergraduate catalogues.
 * These are intentionally not marked as an official catalogue for a particular
 * university: institutions differ and learners can always add their exact programme.
 */
const TERTIARY_OFFERINGS: readonly AcademicOfferingGroup[] = [
  {
    title: "Computing & information technology",
    offerings: [
      "BSc Computer Science",
      "BSc Information Technology",
      "BSc Information Systems",
      "BSc Software Engineering",
      "BSc Data Science",
      "BSc Cybersecurity",
    ],
  },
  {
    title: "Science & engineering",
    offerings: [
      "BSc Mathematics",
      "BSc Statistics",
      "BSc Physics",
      "BSc Chemistry",
      "BSc Biological Sciences",
      "BSc Electrical/Electronic Engineering",
      "BSc Mechanical Engineering",
      "BSc Civil Engineering",
      "BSc Biomedical Engineering",
      "BSc Chemical Engineering",
    ],
  },
  {
    title: "Business & economics",
    offerings: [
      "BSc Business Administration",
      "BSc Accounting",
      "BSc Finance",
      "BSc Economics",
      "BSc Marketing",
      "BSc Human Resource Management",
      "BSc Supply Chain Management",
    ],
  },
  {
    title: "Arts, humanities & social sciences",
    offerings: [
      "BA English",
      "BA History",
      "BA Geography",
      "BA Political Science",
      "BA Sociology",
      "BA Psychology",
      "BA Communication Studies",
      "BA Languages",
      "BA International Relations",
    ],
  },
  {
    title: "Health, education & professional programmes",
    offerings: [
      "BSc Nursing",
      "BSc Public Health",
      "BSc Pharmacy",
      "MBChB Medicine",
      "BDS Dentistry",
      "LLB Law",
      "BEd Education",
      "BSc Agriculture",
      "BSc Architecture",
      "BSc Quantity Surveying",
    ],
  },
];

function isTertiary(level: EducationLevel) {
  return level === "Tertiary";
}

export function academicOfferingsFor(level: EducationLevel): AcademicOfferings {
  if (isTertiary(level)) {
    return {
      kind: "course",
      selectionLabel: "course",
      pluralLabel: "courses",
      heading: "Which course or programme are you studying?",
      supportingText:
        "Choose your degree programme or course area. These are curated programme paths, not a claim about your university’s official course list.",
      customLabel: "Add your exact university course",
      customHint:
        "For example: BSc Information Technology, BA Economics, or Diploma in Graphic Design.",
      groups: TERTIARY_OFFERINGS,
      provenance: "curated-generic",
    };
  }
  return {
    kind: "subject",
    selectionLabel: "subject",
    pluralLabel: "subjects",
    heading: "What subjects are you studying?",
    supportingText:
      "Select every subject you offer. Daily Lessons will rotate between them.",
    customLabel: "Another subject?",
    customHint: "For example: Agricultural Science, Accounting, or Robotics.",
    groups: SCHOOL_OFFERINGS,
    provenance: "school-subject",
  };
}

export function academicSelectionKindFor(
  level: EducationLevel
): AcademicSelectionKind {
  return academicOfferingsFor(level).kind;
}

export function academicSelectionLabelFor(
  level: EducationLevel
): "subject" | "course" {
  return academicOfferingsFor(level).selectionLabel;
}

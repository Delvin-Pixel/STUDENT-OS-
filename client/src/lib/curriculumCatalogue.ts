/**
 * A deliberately narrow, versioned seed. These subject titles are transcribed
 * from NaCCA's published Secondary Education Curriculum listing, reviewed on
 * 2026-08-25. This is a selection aid, not a claim that every learner follows
 * the catalogue or that a custom label is an official subject.
 */
export const GHANA_NACCA_SECONDARY_CATALOGUE = {
  id: "ghana-nacca-secondary-2025",
  version: "2025",
  countryCode: "GH",
  educationSystem: "NaCCA Secondary Education Curriculum",
  sourceUrl: "https://nacca.gov.gh/secondary-education-curriculum/",
  subjects: [
    { id: "additional-mathematics", name: "Additional Mathematics" },
    { id: "agricultural-science", name: "Agricultural Science" },
    { id: "biology", name: "Biology" },
    { id: "chemistry", name: "Chemistry" },
    { id: "computing", name: "Computing" },
    { id: "economics", name: "Economics" },
    { id: "english-language", name: "English Language" },
    { id: "geography", name: "Geography" },
    { id: "mathematics", name: "Mathematics" },
    { id: "physics", name: "Physics" },
    { id: "robotics", name: "Robotics" },
    { id: "social-studies", name: "Social Studies" },
  ],
} as const;

export type CurriculumSubjectProvenance = {
  kind: "catalogue" | "custom" | "unclassified";
  catalogueSubjectId?: string;
};

export type CurriculumContext = {
  countryCode: string;
  educationSystem: string;
  catalogueId: string;
  catalogueVersion: string;
  sourceUrl: string;
};

export function isGhanaNaccaSecondaryContext(
  value: CurriculumContext | undefined
): boolean {
  return (
    value?.countryCode === GHANA_NACCA_SECONDARY_CATALOGUE.countryCode &&
    value.educationSystem === GHANA_NACCA_SECONDARY_CATALOGUE.educationSystem &&
    value.catalogueId === GHANA_NACCA_SECONDARY_CATALOGUE.id &&
    value.catalogueVersion === GHANA_NACCA_SECONDARY_CATALOGUE.version &&
    value.sourceUrl === GHANA_NACCA_SECONDARY_CATALOGUE.sourceUrl
  );
}

export function normalizeAcademicLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function subjectProvenanceForGhanaNaccaSecondary(
  subjects: string[]
): Record<string, CurriculumSubjectProvenance> {
  const catalogueSubjects = new Map(
    GHANA_NACCA_SECONDARY_CATALOGUE.subjects.map(subject => [
      normalizeAcademicLabel(subject.name),
      subject.id,
    ])
  );
  return Object.fromEntries(
    subjects.map(subject => {
      const catalogueSubjectId = catalogueSubjects.get(
        normalizeAcademicLabel(subject)
      );
      return [
        subject,
        catalogueSubjectId
          ? { kind: "catalogue" as const, catalogueSubjectId }
          : { kind: "custom" as const },
      ];
    })
  );
}

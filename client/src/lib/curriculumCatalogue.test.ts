import { describe, expect, it } from "vitest";
import {
  GHANA_NACCA_SECONDARY_CATALOGUE,
  isGhanaNaccaSecondaryContext,
  normalizeAcademicLabel,
  subjectProvenanceForGhanaNaccaSecondary,
} from "./curriculumCatalogue";

describe("optional Ghana NaCCA secondary catalogue", () => {
  it("marks only exact published seed subjects as catalogue entries and retains other labels as custom", () => {
    expect(
      subjectProvenanceForGhanaNaccaSecondary([
        "Mathematics",
        "Robotics",
        "My school elective",
      ])
    ).toEqual({
      Mathematics: { kind: "catalogue", catalogueSubjectId: "mathematics" },
      Robotics: { kind: "catalogue", catalogueSubjectId: "robotics" },
      "My school elective": { kind: "custom" },
    });
  });

  it("normalizes case and repeated whitespace deterministically", () => {
    expect(normalizeAcademicLabel("  Additional   Mathematics ")).toBe(
      "additional mathematics"
    );
  });

  it("keeps official provenance stable while preserving custom labels", () => {
    expect(
      subjectProvenanceForGhanaNaccaSecondary([
        "  additional   mathematics ",
        "Astrophysics",
      ])
    ).toEqual({
      "  additional   mathematics ": {
        kind: "catalogue",
        catalogueSubjectId: "additional-mathematics",
      },
      Astrophysics: { kind: "custom" },
    });
  });

  it("recognizes only the exact versioned cited context", () => {
    expect(
      isGhanaNaccaSecondaryContext({
        countryCode: "GH",
        educationSystem: GHANA_NACCA_SECONDARY_CATALOGUE.educationSystem,
        catalogueId: GHANA_NACCA_SECONDARY_CATALOGUE.id,
        catalogueVersion: GHANA_NACCA_SECONDARY_CATALOGUE.version,
        sourceUrl: GHANA_NACCA_SECONDARY_CATALOGUE.sourceUrl,
      })
    ).toBe(true);
    expect(
      isGhanaNaccaSecondaryContext({
        countryCode: "GH",
        educationSystem: GHANA_NACCA_SECONDARY_CATALOGUE.educationSystem,
        catalogueId: GHANA_NACCA_SECONDARY_CATALOGUE.id,
        catalogueVersion: "unknown",
        sourceUrl: GHANA_NACCA_SECONDARY_CATALOGUE.sourceUrl,
      })
    ).toBe(false);
  });
});

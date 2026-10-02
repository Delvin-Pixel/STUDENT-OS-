import { describe, expect, it } from "vitest";
import {
  academicOfferingsFor,
  academicSelectionKindFor,
  academicSelectionLabelFor,
} from "./academicOfferings";

describe("level-aware academic offerings", () => {
  it("uses school subjects for school levels and tertiary degree programmes for university-level learners", () => {
    const school = academicOfferingsFor("Secondary");
    const tertiary = academicOfferingsFor("Tertiary");

    expect(school.kind).toBe("subject");
    expect(school.groups.flatMap(group => group.offerings)).toContain(
      "Mathematics"
    );
    expect(tertiary.kind).toBe("course");
    expect(tertiary.groups.flatMap(group => group.offerings)).toContain(
      "BSc Information Technology"
    );
    expect(tertiary.groups.flatMap(group => group.offerings)).not.toContain(
      "English Language"
    );
    expect(tertiary.supportingText).toContain("not a claim");
  });

  it("exposes a stable level-derived selection kind and label for persistence and downstream UI", () => {
    expect(academicSelectionKindFor("Tertiary")).toBe("course");
    expect(academicSelectionKindFor("Primary")).toBe("subject");
    expect(academicSelectionLabelFor("Tertiary")).toBe("course");
    expect(academicSelectionLabelFor("Secondary")).toBe("subject");
  });
});

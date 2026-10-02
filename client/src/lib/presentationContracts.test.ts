import { describe, expect, it } from "vitest";
import {
  appearanceToggleLabel,
  dailyLessonAnswerSourceLabel,
  nextAppearanceTheme,
} from "./presentationContracts";

describe("student-facing presentation contracts", () => {
  it("keeps the homepage sun/moon control explicit about the mode it will switch to", () => {
    expect(nextAppearanceTheme("light")).toBe("dark");
    expect(nextAppearanceTheme("dark")).toBe("light");
    expect(appearanceToggleLabel("light")).toBe("Switch to dark mode");
    expect(appearanceToggleLabel("dark")).toBe("Switch to light mode");
  });

  it("branded every answer source as Student OS tutor (never OpenAI in the UI)", () => {
    expect(dailyLessonAnswerSourceLabel("openai")).toBe("Student OS tutor");
    expect(dailyLessonAnswerSourceLabel("studentos")).toBe("Student OS tutor");
  });
});

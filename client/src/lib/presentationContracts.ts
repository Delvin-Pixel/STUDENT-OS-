/** Small client-facing contracts shared by the rendered Student OS interface and Vitest. */
export type AppearanceTheme = "light" | "dark";
export type AnswerSource = "openai" | "studentos";

export function nextAppearanceTheme(theme: AppearanceTheme): AppearanceTheme {
  return theme === "light" ? "dark" : "light";
}

export function appearanceToggleLabel(theme: AppearanceTheme): string {
  return `Switch to ${nextAppearanceTheme(theme)} mode`;
}

/**
 * User requirement: AI-powered answers are always presented under the
 * Student OS brand — never as "OpenAI" or "ChatGPT" in the UI.
 */
export function dailyLessonAnswerSourceLabel(source: AnswerSource): string {
  return source === "openai" ? "Student OS tutor" : "Student OS tutor";
}

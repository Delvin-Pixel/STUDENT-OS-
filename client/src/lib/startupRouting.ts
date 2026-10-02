import type { StudyState } from "@/lib/types";

export type StartupView = "loading" | "onboarding" | "workspace";

/**
 * Device-local startup is intentionally independent of authentication. A new
 * device sees essential profile setup; a device with a completed profile opens
 * directly into its saved Student OS workspace.
 */
export function getStartupView(
  state: Pick<StudyState, "profile">,
  workspaceReady: boolean
): StartupView {
  if (!workspaceReady) return "loading";
  return state.profile ? "workspace" : "onboarding";
}

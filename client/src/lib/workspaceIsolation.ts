import { emptyState } from "./storage";
import type { StudyState } from "./types";

/**
 * A browser can retain the last local workspace even after a different person
 * signs in on that device. Only reuse that cache when it was explicitly saved
 * for the same account; otherwise start the new account from a blank workspace.
 */
export function prepareLocalWorkspaceForAccount(
  cachedState: StudyState,
  cachedAccountId: string | null,
  activeAccountId: string
): { state: StudyState; replaced: boolean } {
  if (cachedAccountId === activeAccountId) {
    return { state: cachedState, replaced: false };
  }

  return { state: emptyState(), replaced: true };
}

import type { StudyState } from "./types";

/**
 * AI-answer ratings are a device-private reflection aid. Keep the canonical
 * workspace shape for simple local persistence, but never send this history to
 * the cloud workspace; that avoids silently changing the privacy promise made
 * in the feedback UI.
 */
export function projectWorkspaceForCloud(state: StudyState): StudyState {
  return { ...state, aiAnswerRatings: [] };
}

/** Reattach the current browser's private feedback after cloud read or merge. */
export function preserveDevicePrivateWorkspaceFields(
  remote: StudyState,
  deviceLocal: StudyState
): StudyState {
  return { ...remote, aiAnswerRatings: deviceLocal.aiAnswerRatings };
}

/** Emits only a stable technical category, never an error message that may contain private content or credentials. */
export function logOperationalFailure(
  scope: string,
  event: string,
  error: unknown
) {
  const errorType =
    error instanceof Error && error.name ? error.name : typeof error;
  console.warn(`[${scope}] ${event}`, { errorType });
}

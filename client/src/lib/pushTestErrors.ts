export function phoneTestErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || /failed to fetch|networkerror|load failed/i.test(message)) {
    return "Student OS could not reach the reminder service. Check your connection, then turn phone reminders off and on again before retrying.";
  }
  return message;
}

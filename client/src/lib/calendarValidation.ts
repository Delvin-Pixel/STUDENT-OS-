import { isoDate } from "./utils";

/** Verifies a local calendar day without accepting JavaScript date rollover. */
export function isValidLocalIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.valueOf()) && isoDate(parsed) === value;
}

/** Converts an operational UTC timestamp into the learner’s local calendar day. */
export function localDateFromTimestamp(timestamp: string): string | null {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed);
}

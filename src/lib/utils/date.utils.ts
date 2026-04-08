/**
 * Native TypeScript replacements for date-fns functions
 * @fileoverview Utility functions for date manipulation and formatting without external dependencies
 */

/**
 * Options for formatDistanceToNow function
 */
interface FormatDistanceToNowOptions {
  /** Whether to add "ago" suffix to the result */
  addSuffix?: boolean;
}

/**
 * Supported date format patterns
 */
type DateFormatPattern = "MMM d" | "PPP";

/**
 * Valid date input types
 */
export type DateInput = Date | string | number;

/**
 * Epoch milliseconds for sorting and equality; supports JSON ISO strings from APIs.
 *
 * @param value - Date instance, timestamp number, or ISO string
 * @returns Milliseconds since Unix epoch
 */
export function timeMs(value: DateInput): number {
  return new Date(value).getTime();
}

/**
 * Calculate the number of full days between two dates
 * @param date1 - The first date
 * @param date2 - The second date
 * @returns The absolute difference in days (always positive)
 * @example
 * const days = differenceInDays(new Date('2024-01-10'), new Date('2024-01-05'));
 * console.log(days); // 5
 */
export const differenceInDays = (
  date1: DateInput,
  date2: DateInput,
): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(12, 0, 0, 0);
  d2.setHours(12, 0, 0, 0);
  const diffTime = Math.abs(d1.getTime() - d2.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format a date in "MMM d" pattern (e.g., "Jan 5")
 * @param date - The date to format
 * @returns The formatted date string
 * @example
 * const formatted = formatMMMd(new Date('2024-01-05'));
 * console.log(formatted); // "Jan 5"
 */
export const formatMMMd = (date: DateInput): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
};

/**
 * Format a date in long format (e.g., "January 5, 2024")
 * Similar to date-fns PPP format but without ordinal suffixes
 * @param date - The date to format
 * @returns The formatted date string
 * @example
 * const formatted = formatPPP(new Date('2024-01-05'));
 * console.log(formatted); // "January 5, 2024"
 */
export const formatPPP = (date: DateInput): string => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
};

/**
 * Format the distance from a given date to now in human-readable format
 * @param date - The date to compare to now
 * @param options - Configuration options
 * @returns Human-readable time difference
 * @example
 * const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
 * console.log(formatDistanceToNow(pastDate)); // "2 hours"
 * console.log(formatDistanceToNow(pastDate, { addSuffix: true })); // "2 hours ago"
 */
export const formatDistanceToNow = (
  date: DateInput,
  options: FormatDistanceToNowOptions = {},
): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let result: string;
  if (diffYears > 0) {
    result = `${diffYears} year${diffYears > 1 ? "s" : ""}`;
  } else if (diffMonths > 0) {
    result = `${diffMonths} month${diffMonths > 1 ? "s" : ""}`;
  } else if (diffDays > 0) {
    result = `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  } else if (diffHours > 0) {
    result = `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  } else if (diffMinutes > 0) {
    result = `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
  } else {
    result = `${diffSeconds} second${diffSeconds !== 1 ? "s" : ""}`;
  }

  return options.addSuffix ? `${result} ago` : result;
};

/**
 * Generic date formatter for common patterns
 * @param date - The date to format
 * @param pattern - The pattern to use ('MMM d', 'PPP', or defaults to locale string)
 * @returns The formatted date string
 * @example
 * const date = new Date('2024-01-05');
 * console.log(formatDate(date, 'MMM d')); // "Jan 5"
 * console.log(formatDate(date, 'PPP')); // "January 5, 2024"
 */
export const formatDate = (
  date: DateInput,
  pattern?: DateFormatPattern,
): string => {
  switch (pattern) {
    case "MMM d":
      return formatMMMd(date);
    case "PPP":
      return formatPPP(date);
    default:
      return new Date(date).toLocaleDateString();
  }
};

/**
 * Format a date-only string (YYYY-MM-DD) as a full local date.
 * Avoids the UTC-midnight timezone shift that occurs with new Date("YYYY-MM-DD").
 * @param dateStr - ISO date-only string, e.g. "2026-04-07"
 * @returns e.g. "Tuesday, April 7, 2026"
 */
export const formatLocalDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

/**
 * Format a date/time using a consistent local representation.
 *
 * This is intentionally `Date | string` friendly because many values arrive
 * from the API as serialized ISO strings (where `instanceof Date` checks
 * would fail in the UI).
 *
 * @param date - Date-like value to format.
 * @returns A human-friendly local date/time string, or `—` for invalid dates.
 */
export const formatDateTimeLocal = (date: DateInput): string => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
};

/**
 * In-memory email capture for E2E tests. Only used when E2E_TEST=1.
 * Last-wins semantics per type (verification | reset).
 */

export type EmailCaptureType = "verification" | "reset";

const captured = new Map<EmailCaptureType, string>();

/**
 * Store the last URL sent for the given email type. Replaces any previous value.
 */
export function captureEmail(type: EmailCaptureType, url: string): void {
  captured.set(type, url);
}

/**
 * Return the last captured URL for the given type, or null if none.
 */
export function getLastCapturedUrl(type: EmailCaptureType): string | null {
  return captured.get(type) ?? null;
}

/**
 * Clear all captured URLs. Use for test isolation when needed.
 */
export function clearCapturedEmails(): void {
  captured.clear();
}

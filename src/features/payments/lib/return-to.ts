/**
 * Open-redirect protection for the JIT onboarding flow's `?returnTo=` param.
 *
 * Accepts only relative URLs that resolve under `/dashboard/`. Anything else
 * (absolute URLs, protocol-relative `//evil.com`, paths outside `/dashboard/`,
 * etc.) returns null and the caller falls back to default behavior.
 */
const DASHBOARD_PATH_PATTERN = /^\/dashboard\/[^/].*$/;

export function validateReturnTo(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0) {
    return null;
  }
  // Reject protocol-relative URLs like "//evil.com" — the second char must not
  // be a slash. The regex also covers this, but checking explicitly keeps the
  // intent obvious.
  if (input.startsWith("//")) {
    return null;
  }
  return DASHBOARD_PATH_PATTERN.test(input) ? input : null;
}

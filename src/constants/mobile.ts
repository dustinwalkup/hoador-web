/**
 * Mobile app constants shared across the backend.
 *
 * The custom URL scheme and its deep-link paths are referenced in more than one
 * place (better-auth `trustedOrigins`, the Stripe Connect bounce pages), so they
 * live here rather than being re-declared per call site. Must stay in sync with
 * `hoador-mobile/app.config.ts`.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-01-backend-auth.md (D-E1-3)
 *       hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (D-E2-6)
 */

/** The app's custom URL scheme (no `://`). */
export const MOBILE_APP_SCHEME = "hoador";

/**
 * Deep-link targets the app registers. Stripe cannot redirect to a custom
 * scheme directly (it requires public https URLs), so these are the
 * destinations the `/mobile/connect-*` bounce pages hand off to.
 */
export const MOBILE_DEEP_LINKS = {
  connectReturn: `${MOBILE_APP_SCHEME}://connect/return`,
  connectRefresh: `${MOBILE_APP_SCHEME}://connect/refresh`,
} as const;

/**
 * HTTPS bounce-page paths on the web app. Stripe's Account Link
 * `return_url`/`refresh_url` point here; each page forwards into the app via the
 * matching `MOBILE_DEEP_LINKS` target (universal link, with a tap-through
 * fallback until the association files are served).
 */
export const MOBILE_CONNECT_RETURN_PATH = "/mobile/connect-return";
export const MOBILE_CONNECT_REFRESH_PATH = "/mobile/connect-refresh";

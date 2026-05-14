/**
 * E2E auth test constants. Must match src/db/seeds/e2e.seed.ts.
 */
export const E2E_JOIN_CODE = "E2E-JOIN-CODE";
export const E2E_PASSWORD = "E2eTestPassword1!";

export const E2E_USER_ACTIVE = "active@e2e.test";
export const E2E_USER_EMAIL_VERIFIED = "email_verified@e2e.test";
export const E2E_USER_INCOMPLETE = "incomplete@e2e.test";
export const E2E_USER_UNVERIFIED = "unverified@e2e.test";
export const E2E_USER_ADMIN = "admin@e2e.test";
export const E2E_USER_PASSWORD_RESET = "password_reset@e2e.test";

/** Active user with a primary KC Metro membership + full network visibility. */
export const E2E_USER_METRO_MEMBER = "metro_member@e2e.test";
/** Active user whose primary membership is still `pending` admin verification. */
export const E2E_USER_PENDING_MEMBER = "pending_member@e2e.test";

/** Canonical KC Metro community used by the community-select flow. */
export const E2E_PRIMARY_COMMUNITY_NAME = "Foxcroft";
/** A non-primary KC Metro community — toggled in the visibility-settings test. */
export const E2E_SECONDARY_COMMUNITY_NAME = "Glen Arbor Estates";

/** Used by E2E Google OAuth mock (code param). See src/lib/e2e-google-callback.ts */
export const E2E_GOOGLE_CODE = "e2e-test-google";
/** Default test user for Google OAuth (find-or-create by email). */
export const E2E_GOOGLE_USER_EMAIL = "google@e2e.test";

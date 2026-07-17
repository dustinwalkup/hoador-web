import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import { E2E_USER_ACTIVE } from "./constants";

/**
 * End-to-end proof of the mobile auth transport (design D3 / Req 2.1.2) against
 * real Postgres: a session cookie sent as an explicit `Cookie` header — with no
 * browser cookie jar — resolves on the existing `/api/*` routes, which resolve
 * sessions via `auth.api.getSession({ headers })`.
 *
 * This is what `hoador-mobile`'s `apiFetch` does on every call
 * (`Cookie: authClient.getCookie()`). The vitest suite
 * (`src/services/better-auth/__tests__/mobile-cookie-transport.test.ts`) covers
 * the same claim on PR CI against an in-memory adapter; this one closes the loop
 * over real HTTP + real DB.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-01-backend-auth.md (task 1.2, D-E1-1).
 */
test.describe("Mobile session cookie transport", () => {
  test("session cookie sent as a Cookie header (no cookie jar) authenticates an API route", async ({
    page,
    playwright,
  }) => {
    // Arrange — sign in to mint a real session, then take the cookie the way the
    // Expo plugin hands it to SecureStore.
    await login(page, E2E_USER_ACTIVE);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes("session_token"));
    expect(
      sessionCookie,
      "expected a better-auth session cookie after login",
    ).toBeTruthy();
    const cookieHeader = `${sessionCookie!.name}=${sessionCookie!.value}`;

    // A context with no stored cookies — the only credential is the header,
    // exactly like the mobile app.
    const context = await playwright.request.newContext({
      baseURL: page.url(),
    });

    try {
      // Act
      const authed = await context.get("/api/profile", {
        headers: { Cookie: cookieHeader },
      });
      const anonymous = await context.get("/api/profile");

      // Assert — the header alone is sufficient, and its absence is fatal.
      expect(authed.status(), await authed.text()).toBe(200);
      expect(anonymous.status()).toBe(401);
    } finally {
      await context.dispose();
    }
  });
});

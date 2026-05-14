import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { E2E_PASSWORD } from "./constants";

/**
 * Run a fresh email/password signup and follow the email-verification link,
 * leaving `page` on the canonical post-verification step (`/community-select`).
 *
 * Mirrors the funnel: `/signup` → `/verify-email` → (verification link) →
 * `/community-select`. Returns the new user's email.
 */
export async function signupAndReachCommunitySelect(
  page: Page,
  request: APIRequestContext,
): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e2e.test`;

  await page.goto("/signup");
  await expect(page).toHaveURL(/\/signup/);

  await page.getByLabel(/first name/i).fill("E2E");
  await page.getByLabel(/last name/i).fill("User");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
  await page
    .getByRole("checkbox", { name: /terms of service|privacy/i })
    .check();
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/verify-email/);

  const res = await request.get("/api/test/last-email?type=verification");
  expect(res.ok()).toBe(true);
  const { url } = (await res.json()) as { url: string | null };
  expect(url).toBeTruthy();

  // Use the running test server's origin (e.g. :3001), not the link's origin.
  const link = new URL(url!);
  await page.goto(new URL(link.pathname + link.search, page.url()).href);

  await expect(page).toHaveURL(/\/community-select/);
  return email;
}

/**
 * Sign in via the login form and wait for the post-login redirect to settle
 * (i.e. the URL leaves `/login`). The login form fires an async request and
 * then `router.push`es, so callers that immediately `page.goto(...)` would
 * otherwise race the in-flight client navigation and hit `net::ERR_ABORTED`.
 * Does not assert *which* page you land on.
 */
export async function login(
  page: Page,
  email: string,
  password = E2E_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

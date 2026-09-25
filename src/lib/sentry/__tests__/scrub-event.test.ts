import type * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrubSentryEvent } from "../scrub-event";

function makeEvent(
  overrides: Partial<Sentry.ErrorEvent> = {},
): Sentry.ErrorEvent {
  return { type: undefined, ...overrides } as Sentry.ErrorEvent;
}

function hintFor(originalException: unknown): Sentry.EventHint {
  return { originalException };
}

describe("scrubSentryEvent", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([404, 400, 401])("drops errors with status %i", (status) => {
    const error = Object.assign(new Error("boom"), { status });
    expect(scrubSentryEvent(makeEvent(), hintFor(error))).toBeNull();
  });

  it.each([
    "Listing not found",
    "Validation failed",
    "Unauthorized",
    "Authentication required",
  ])("drops errors whose message is expected: %s", (message) => {
    expect(
      scrubSentryEvent(makeEvent(), hintFor(new Error(message))),
    ).toBeNull();
  });

  it("strips request cookies and headers but keeps the url", () => {
    const event = makeEvent({
      request: {
        url: "https://hoador.test/api/rentals",
        cookies: { "better-auth.session_token": "secret" },
        headers: { cookie: "better-auth.session_token=secret" },
      },
    });

    const result = scrubSentryEvent(event, hintFor(new Error("boom")));

    expect(result?.request).toEqual({ url: "https://hoador.test/api/rentals" });
  });

  it("reduces the user to its id", () => {
    const event = makeEvent({
      user: { id: "u1", email: "a@b.com", username: "A" },
    });

    const result = scrubSentryEvent(event, hintFor(new Error("boom")));

    expect(result?.user).toEqual({ id: "u1" });
  });

  it("drops a user that has no id", () => {
    const event = makeEvent({ user: { email: "a@b.com" } });

    const result = scrubSentryEvent(event, hintFor(new Error("boom")));

    expect(result?.user).toBeUndefined();
  });

  it("sends nothing outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const event = makeEvent({
      request: { cookies: { a: "b" } },
      user: { id: "u1", email: "a@b.com" },
    });

    expect(scrubSentryEvent(event, hintFor(new Error("boom")))).toBeNull();
  });
});

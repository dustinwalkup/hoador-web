import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleBetterAuthSignInError } from "../errors";

describe("handleBetterAuthSignInError", () => {
  const locationMock = { href: "" };

  beforeEach(() => {
    locationMock.href = "";
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: window.location,
      writable: true,
    });
  });

  it("redirects to verify-email with email when EMAIL_NOT_VERIFIED and body has email", () => {
    const context = {
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      request: { body: JSON.stringify({ email: "user@example.com" }) },
    } as any;
    handleBetterAuthSignInError(context);
    expect(locationMock.href).toBe("/verify-email?email=user%40example.com");
  });

  it("redirects to /verify-email without throwing when body is missing", () => {
    const context = {
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      request: {},
    } as any;
    expect(() => handleBetterAuthSignInError(context)).not.toThrow();
    expect(locationMock.href).toBe("/verify-email");
  });

  it("redirects to /verify-email when body is invalid JSON", () => {
    const context = {
      error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      request: { body: "not valid json" },
    } as any;
    expect(() => handleBetterAuthSignInError(context)).not.toThrow();
    expect(locationMock.href).toBe("/verify-email");
  });
});

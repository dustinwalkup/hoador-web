import { describe, expect, it } from "vitest";

import { toError } from "../to-error";

describe("toError", () => {
  it("returns the same instance when passed an Error", () => {
    const original = new Error("boom");
    expect(toError(original)).toBe(original);
  });

  it("returns the same instance for Error subclasses", () => {
    class CustomError extends Error {}
    const original = new CustomError("custom");
    expect(toError(original)).toBe(original);
  });

  it("wraps an object with status and statusText into an HTTP message", () => {
    const original = { status: 500, statusText: "Internal Server Error" };
    const result = toError(original);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("HTTP 500 Internal Server Error");
    expect(result.cause).toBe(original);
  });

  it("prefers a string message field when present", () => {
    const original = {
      message: "Invalid credentials",
      status: 401,
      statusText: "Unauthorized",
    };
    const result = toError(original);
    expect(result.message).toBe("Invalid credentials");
    expect(result.cause).toBe(original);
  });

  it("uses the fallback message for an object without recognizable fields", () => {
    const original = { foo: "bar" };
    const result = toError(original, "Auth error");
    expect(result.message).toBe("Auth error");
    expect(result.cause).toBe(original);
  });

  it("wraps a string into an Error with that string as message", () => {
    const result = toError("something failed");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("something failed");
  });

  it("falls back to the default message for null", () => {
    const result = toError(null, "fallback");
    expect(result.message).toBe("fallback");
    expect(result.cause).toBe(null);
  });

  it("falls back to the default message for undefined", () => {
    const result = toError(undefined, "fallback");
    expect(result.message).toBe("fallback");
    expect(result.cause).toBe(undefined);
  });

  it("ignores a non-string message field on the object", () => {
    const original = { message: 42, status: 503, statusText: "Unavailable" };
    const result = toError(original);
    expect(result.message).toBe("HTTP 503 Unavailable");
  });
});

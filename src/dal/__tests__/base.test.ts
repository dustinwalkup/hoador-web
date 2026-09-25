import { describe, it, expect, vi, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { BaseDAL } from "../base";
import { ConflictError, ValidationError, DALError } from "../errors";

vi.mock("@sentry/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/nextjs")>()),
  captureException: vi.fn(),
}));

class ProbeDAL extends BaseDAL {
  map(error: unknown): never {
    this.handleError(error, "ProbeDAL.map");
  }
}

describe("BaseDAL.handleError (SEC-16 / TEST-07 / roadmap 1.7)", () => {
  const probe = new ProbeDAL();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    ["DrizzleQueryError shape (code on .cause)", { cause: { code: "23505" } }],
    [
      "flat { code } shape (back-compat with existing mocked DAL tests)",
      { code: "23505" },
    ],
  ])("maps a unique violation, %s, to ConflictError", (_label, shape) => {
    const error = Object.assign(new Error("dup"), shape);
    expect(() => probe.map(error)).toThrow(ConflictError);
  });

  it.each(["23503", "23514"])(
    "maps .cause code %s to ValidationError",
    (code) => {
      const error = Object.assign(new Error("wrapped"), { cause: { code } });
      expect(() => probe.map(error)).toThrow(ValidationError);
    },
  );

  it("never repeats the driver message in an unrecognized error's mapping", () => {
    const secret =
      'Failed query: select * from "user" where email = $1\nparams: ["x@example.com"]';
    const error = Object.assign(new Error(secret), {
      cause: { code: "42704", message: 'column "foo" does not exist' },
    });

    let caught: unknown;
    try {
      probe.map(error);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DALError);
    expect((caught as DALError).statusCode).toBe(500);
    expect((caught as DALError).message).not.toContain("Failed query");
    expect((caught as DALError).message).not.toContain("params:");
    expect((caught as DALError).message).not.toContain("does not exist");
  });

  // Side effect of the fix worth pinning: before it, `isUnexpectedError`
  // checked the unwrapped `error.code`, so it was always true for a drizzle
  // error and every constraint violation reached Sentry in production.
  it("does not report an expected constraint violation to Sentry in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = Object.assign(new Error("dup"), { cause: { code: "23505" } });
    expect(() => probe.map(error)).toThrow(ConflictError);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

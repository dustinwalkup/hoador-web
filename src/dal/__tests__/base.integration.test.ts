import { describe, it, expect } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { BaseDAL } from "../base";
import { ConflictError } from "../errors";
import { createUser } from "@/test/integration/factories";

/**
 * TEST-07 / SEC-16, against a REAL Postgres: what drizzle-orm 0.45 actually
 * throws on a constraint violation. Every mocked DAL test fabricates
 * `{ code: "23505" }` on the thrown error itself; drizzle never produces that.
 * It wraps the driver error in `DrizzleQueryError` and the pg code lives on
 * `.cause`. These tests pin that shape so a mock can be checked against it.
 */

/** Exposes the protected mapper, fed the real driver error. */
class ProbeDAL extends BaseDAL {
  map(error: unknown): never {
    this.handleError(error, "ProbeDAL.map");
  }
}

async function duplicateEmailError(): Promise<unknown> {
  const existing = await createUser();
  try {
    await db.insert(schema.user).values({
      id: "user-duplicate",
      name: "Duplicate",
      email: existing.email,
    });
  } catch (error) {
    return error;
  }
  throw new Error("expected the duplicate insert to be rejected");
}

describe("real constraint errors (TEST-07)", () => {
  it("wraps a unique violation in DrizzleQueryError with the pg code on .cause", async () => {
    const error = await duplicateEmailError();

    expect(error).toBeInstanceOf(DrizzleQueryError);
    // The shape every mocked test assumes: absent on the real thing.
    expect((error as { code?: string }).code).toBeUndefined();
    const cause = (error as { cause?: { code?: string; constraint?: string } })
      .cause;
    expect(cause?.code).toBe("23505");
    expect(cause?.constraint).toBe("user_email_unique");
  });

  // SEC-16, open until remediation-roadmap item 1.7 maps
  // `(error.cause ?? error).code`. `it.fails` passes while the bug is present
  // and fails once it is fixed: flip it to `it` in that change.
  it.fails(
    "is mapped to ConflictError by BaseDAL.handleError (SEC-16, roadmap 1.7)",
    async () => {
      const error = await duplicateEmailError();
      const probe = new ProbeDAL();

      expect(() => probe.map(error)).toThrow(ConflictError);
    },
  );
});

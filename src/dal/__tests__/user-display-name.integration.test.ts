import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

/**
 * `user.name` follows first/last (mobile P-E14-2) against a REAL Postgres:
 * the recomposition is one SQL expression over the row being updated, which a
 * mocked `db` cannot evaluate.
 */

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { userDAL } from "@/dal";
import { createUser } from "@/test/integration/factories";

const { user } = schema;

async function storedName(id: string) {
  const [row] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, id));
  return row?.name;
}

describe("user.name follows first/last (real DB)", () => {
  it("rewrites the name when both parts change", async () => {
    const u = await createUser({
      name: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
    });

    await userDAL.updateUser(u.id, { firstName: "Janet", lastName: "Smith" });

    expect(await storedName(u.id)).toBe("Janet Smith");
  });

  it("keeps the stored last name on a first-name-only change", async () => {
    const u = await createUser({
      name: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
    });

    await userDAL.updateUser(u.id, { firstName: "Janet" });

    expect(await storedName(u.id)).toBe("Janet Doe");
  });

  it("skips a missing last name rather than leaving a trailing space", async () => {
    const u = await createUser({
      name: "Cher",
      firstName: "Cher",
      lastName: null,
    });

    await userDAL.updateUser(u.id, { firstName: "Cherilyn" });

    expect(await storedName(u.id)).toBe("Cherilyn");
  });

  it("leaves the name alone when neither part is written", async () => {
    const u = await createUser({
      name: "Sign-up Name",
      firstName: "Jane",
      lastName: "Doe",
    });

    await userDAL.updateUser(u.id, { bio: "Hello" });

    expect(await storedName(u.id)).toBe("Sign-up Name");
  });

  it("recomposes it when onboarding completes with edited names", async () => {
    const u = await createUser({
      name: "jane doe",
      firstName: "jane",
      lastName: "doe",
      status: "incomplete_profile",
    });

    await userDAL.completeOnboarding(u.id, {
      firstName: "Jane",
      lastName: "Doe-Ray",
    });

    expect(await storedName(u.id)).toBe("Jane Doe-Ray");
  });
});

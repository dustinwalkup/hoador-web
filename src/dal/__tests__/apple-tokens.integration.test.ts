import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Sign in with Apple token storage and its hand-off to deletion (Req 2.5.5,
 * mobile P-E14-4) against a REAL Postgres. The tokens live on `account` rows
 * that `anonymizeUser` deletes, so they must be read inside the same
 * transaction, before the delete.
 */

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { accountDeletionDAL, userDAL } from "@/dal";
import { createUser } from "@/test/integration/factories";

const { account } = schema;

async function linkAccount(
  userId: string,
  providerId: string,
  overrides: Partial<typeof account.$inferInsert> = {},
) {
  const [row] = await db
    .insert(account)
    .values({
      id: `acct-${providerId}-${userId}`,
      accountId: `${providerId}-sub-${userId}`,
      providerId,
      userId,
      ...overrides,
    })
    .returning();
  return row;
}

describe("Sign in with Apple tokens (real DB)", () => {
  it("getAppleAccount finds only the Apple row", async () => {
    const u = await createUser();
    await linkAccount(u.id, "google");
    const apple = await linkAccount(u.id, "apple");

    expect(await userDAL.getAppleAccount(u.id)).toEqual({
      id: apple.id,
      appleUserId: apple.accountId,
    });
  });

  it("getAppleAccount returns null for a user who never used Apple", async () => {
    const u = await createUser();
    await linkAccount(u.id, "credential");

    expect(await userDAL.getAppleAccount(u.id)).toBeNull();
  });

  it("setAppleRefreshToken stores the pair without touching better-auth's token", async () => {
    const u = await createUser();
    const apple = await linkAccount(u.id, "apple", { refreshToken: "web-r" });

    await userDAL.setAppleRefreshToken(apple.id, {
      refreshToken: "native-r",
      clientId: "com.hoador.app",
    });

    const [stored] = await db
      .select()
      .from(account)
      .where(eq(account.id, apple.id));
    expect(stored).toMatchObject({
      appleRefreshToken: "native-r",
      appleClientId: "com.hoador.app",
      refreshToken: "web-r",
    });
  });

  it("anonymizeUser hands back the Apple tokens it deletes, native and web", async () => {
    const u = await createUser();
    await linkAccount(u.id, "apple", {
      refreshToken: "web-r",
      appleRefreshToken: "native-r",
      appleClientId: "com.hoador.app",
    });
    // Another provider's refresh token is never sent to Apple.
    await linkAccount(u.id, "google", { refreshToken: "google-r" });

    const result = await accountDeletionDAL.anonymizeUser(u.id);

    expect(result.appleTokens).toEqual([
      { refreshToken: "native-r", clientId: "com.hoador.app" },
      { refreshToken: "web-r", clientId: null },
    ]);
    expect(
      await db.select().from(account).where(eq(account.userId, u.id)),
    ).toEqual([]);
  });

  it("anonymizeUser returns no Apple tokens for a user with none stored", async () => {
    const u = await createUser();
    await linkAccount(u.id, "apple");

    expect((await accountDeletionDAL.anonymizeUser(u.id)).appleTokens).toEqual(
      [],
    );
  });
});

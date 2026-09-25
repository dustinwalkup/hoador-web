import { describe, it, expect } from "vitest";
import { pushSubscriptionDAL } from "@/dal";
import { SubscriptionLimitReachedError } from "../errors";
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from "@/constants/rate-limits";
import { createUser } from "@/test/integration/factories";

/**
 * SEC-13, against a real Postgres: a standing cap on a user's ACTIVE push
 * subscriptions. Checked only when a new row would be inserted — a device
 * refreshing its own endpoint/token is never blocked by its own cap.
 */

const endpoint = (i: number) => `https://fcm.googleapis.com/fcm/send/cap-${i}`;
const keys = { p256dh: "BNcRdreALRF", auth: "tBHItq" };
// `Expo.isExpoPushToken` is not applied by the DAL; any unique token will do.
const token = (i: number) => `ExponentPushToken[cap-${i}]`;

async function fillToCap(userId: string) {
  for (let i = 0; i < MAX_PUSH_SUBSCRIPTIONS_PER_USER; i++) {
    await pushSubscriptionDAL.create(userId, { endpoint: endpoint(i), keys });
  }
}

describe("push subscription cap (SEC-13, real DB)", () => {
  it("refuses a new web endpoint once the user is at the cap", async () => {
    const u = await createUser();
    await fillToCap(u.id);

    await expect(
      pushSubscriptionDAL.create(u.id, { endpoint: endpoint(99), keys }),
    ).rejects.toThrow(SubscriptionLimitReachedError);
    expect(await pushSubscriptionDAL.getActiveByUserId(u.id)).toHaveLength(
      MAX_PUSH_SUBSCRIPTIONS_PER_USER,
    );
  });

  it("refuses a new native token once the user is at the cap", async () => {
    const u = await createUser();
    await fillToCap(u.id);

    await expect(
      pushSubscriptionDAL.createNative(u.id, {
        platform: "ios",
        token: token(99),
      }),
    ).rejects.toThrow(SubscriptionLimitReachedError);
  });

  it("still refreshes an existing endpoint or token at the cap", async () => {
    const u = await createUser();
    await pushSubscriptionDAL.createNative(u.id, {
      platform: "android",
      token: token(0),
    });
    for (let i = 1; i < MAX_PUSH_SUBSCRIPTIONS_PER_USER; i++) {
      await pushSubscriptionDAL.create(u.id, { endpoint: endpoint(i), keys });
    }

    await expect(
      pushSubscriptionDAL.create(u.id, { endpoint: endpoint(1), keys }),
    ).resolves.toMatchObject({ endpoint: endpoint(1), isActive: true });
    await expect(
      pushSubscriptionDAL.createNative(u.id, {
        platform: "android",
        token: token(0),
      }),
    ).resolves.toMatchObject({ token: token(0), isActive: true });
  });

  it("counts only active rows toward the cap", async () => {
    const u = await createUser();
    await fillToCap(u.id);
    const [oldest] = await pushSubscriptionDAL.getActiveByUserId(u.id);
    await pushSubscriptionDAL.deactivate(oldest.id);

    await expect(
      pushSubscriptionDAL.create(u.id, { endpoint: endpoint(99), keys }),
    ).resolves.toMatchObject({ endpoint: endpoint(99) });
  });
});

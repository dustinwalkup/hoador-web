import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * CONC-03 (service half) against a REAL Postgres: a provider's decline cannot
 * overwrite a booking whose accept charge has been claimed, and decline and
 * the claim cannot both win. Notifications and Stripe are mocked; every
 * database statement is real, and the race runs on two pooled connections.
 */

const mockSendBookingDeclined = vi.fn();
vi.mock("@/features/services/notifications/service-notifications", () => ({
  sendNewBookingRequestNotification: vi.fn(),
  sendBookingAcceptedNotification: vi.fn(),
  sendBookingDeclinedNotification: (...a: unknown[]) =>
    mockSendBookingDeclined(...a),
  sendJobCompletedNotification: vi.fn(),
  sendServicePayoutNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/stripe/server", () => ({ PAYMENT_SERVER_INSTANCE: {} }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { serviceBookingDAL } from "@/dal";
import { ConflictError } from "@/dal/errors";
import { ServiceBookingService } from "../service-booking-service";
import {
  createUser,
  createServiceListing,
  createServiceBooking,
} from "@/test/integration/factories";
import {
  raceTwo,
  expectExactlyOneFulfilled,
} from "@/test/integration/run-concurrently";

const { serviceBookings } = schema;

const reload = async (id: string) =>
  (
    await db.select().from(serviceBookings).where(eq(serviceBookings.id, id))
  )[0];

async function pendingBooking() {
  const provider = await createUser({ stripeConnectedAccountId: "acct_race" });
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id);
  return { provider, booking };
}

describe("service decline vs accept (CONC-03, real DB)", () => {
  it("will not decline a booking whose accept charge is claimed", async () => {
    const { provider, booking } = await pendingBooking();
    expect(await serviceBookingDAL.claimForAcceptance(booking.id)).toBe(true);

    await expect(
      ServiceBookingService.declineBooking(
        booking.id,
        provider.id,
        "Not available",
        {},
      ),
    ).rejects.toThrow(ConflictError);

    const stored = await reload(booking.id);
    expect(stored.status).toBe("pending");
    expect(stored.paymentStatus).toBe("processing");
    expect(mockSendBookingDeclined).not.toHaveBeenCalled();
  });

  it("lets exactly one of decline and accept's claim win a real race", async () => {
    const { provider, booking } = await pendingBooking();

    const { results } = await raceTwo(
      async () => {
        await ServiceBookingService.declineBooking(
          booking.id,
          provider.id,
          "Not available",
          {},
        );
        return "declined" as const;
      },
      async () => {
        if (!(await serviceBookingDAL.claimForAcceptance(booking.id))) {
          throw new Error("claim lost");
        }
        return "claimed" as const;
      },
    );

    const { fulfilled } = expectExactlyOneFulfilled(results);
    const stored = await reload(booking.id);
    if (fulfilled.value === "declined") {
      expect(stored.status).toBe("declined");
      expect(stored.paymentStatus).toBeNull();
    } else {
      expect(stored.status).toBe("pending");
      expect(stored.paymentStatus).toBe("processing");
    }
  });
});

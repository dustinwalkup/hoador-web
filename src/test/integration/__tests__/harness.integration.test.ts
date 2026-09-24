import { describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import {
  createUser,
  createListing,
  createRentalRequest,
  createServiceListing,
  createServiceBooking,
} from "../factories";
import { createBarrier } from "../stripe-barrier";
import { raceTwo, expectExactlyOneFulfilled } from "../run-concurrently";

/**
 * The harness itself, so a race test in R-BIZ-01 / R-CONC-01 / R-CONC-02 can
 * trust it: every factory inserts against the real schema, and `raceTwo` puts
 * two statements on two connections at once.
 */

describe("integration harness", () => {
  it("inserts a valid row through every factory", async () => {
    const owner = await createUser();
    const renter = await createUser();
    const listing = await createListing(owner.id);
    const request = await createRentalRequest(listing.id, renter.id, owner.id);
    const serviceListing = await createServiceListing(owner.id);
    const booking = await createServiceBooking(serviceListing, renter.id);

    expect(request.status).toBe("pending");
    expect(booking.status).toBe("pending");
    expect(booking.providerId).toBe(owner.id);
  });

  it("starts each test from empty tables", async () => {
    const users = await db.select().from(schema.user);

    expect(users).toHaveLength(0);
  });

  // The compare-and-set pattern the race plans depend on, raced for real: two
  // transitions of one pending request, both parked until the barrier opens.
  // Exactly one UPDATE ... WHERE status = 'pending' can match.
  it("races two compare-and-set updates on separate connections", async () => {
    const owner = await createUser();
    const renter = await createUser();
    const listing = await createListing(owner.id);
    const request = await createRentalRequest(listing.id, renter.id, owner.id);
    const barrier = createBarrier();

    const transition = (status: "approved" | "cancelled") => async () => {
      await barrier.wait();
      const [row] = await db
        .update(schema.rentalRequests)
        .set({ status })
        .where(
          and(
            eq(schema.rentalRequests.id, request.id),
            eq(schema.rentalRequests.status, "pending"),
          ),
        )
        .returning();
      if (!row) throw new Error(`lost the race to ${status}`);
      return row.status;
    };

    const race = raceTwo(transition("approved"), transition("cancelled"));
    barrier.release();
    const { results } = await race;

    const { fulfilled } = expectExactlyOneFulfilled(results);
    const [stored] = await db
      .select()
      .from(schema.rentalRequests)
      .where(eq(schema.rentalRequests.id, request.id));
    expect(stored.status).toBe(fulfilled.value);
  });
});

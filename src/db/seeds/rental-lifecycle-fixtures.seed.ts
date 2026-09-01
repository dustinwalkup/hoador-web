/**
 * Rental-lifecycle device-verification fixtures (mobile Epic 8A).
 *
 * `seed:schedule` (P-E8-3) covers what **Schedule** needs: activity spread
 * across months, a rental crossing a month boundary, a live 72-hour countdown.
 * Epic 8A then added six surfaces it does not reach, and this covers those:
 *
 *   - **deposit hold states** — `seed:schedule` writes none at all, so the
 *     eight-state pill (Req 14.1.2) and the retry path (Req 9.2.6/14.1.3) have
 *     never been seen. A *failed* hold in particular **cannot be produced by
 *     using the app**: it needs a card that declines an authorization, so
 *     without a fixture that path ships unverified.
 *   - **an approved rental starting today** — 8A.5's "Start rental" is otherwise
 *     unreachable, because `seed:schedule`'s only approved rental starts at
 *     month end.
 *   - **an approved rental under 24 hours out** — the half-refund tier
 *     (Req 9.3.1), which is the refund a renter is least likely to expect and so
 *     the one most worth seeing.
 *   - **a completed rental with a condition and damage record** — 8A.5's
 *     read-back and the payout timeline (Req 10.2.4).
 *   - **blocked days on a listing the tester does not own** — 8A.1's date picker
 *     (Req 9.1.2), which greys days out from `bookedRanges` (P-E8A-2).
 *
 * **This script is ADDITIVE. It never truncates.** Same rule and same reason as
 * `seed:schedule`: `seed.ts` truncates ~45 tables including `user` and
 * `session`, which against a shared environment would destroy the Stripe Connect
 * account from task 7.2.2 and every live session. This tags its own rows and
 * replaces only those.
 *
 * ⚠️ **What these fixtures CANNOT make verifiable.** Anything that needs a real
 * Stripe object fails at the point it reaches Stripe, and no seed can fix that:
 *
 *   - **Confirming** a cancellation on an approved rental → the refund needs a
 *     real charge (`cancelApprovedRental` returns "Missing payment or charge
 *     data"). The refund **tier and amounts are still verifiable** — that is the
 *     part Req 9.3.1 is about, and it is a pure read.
 *   - **Retrying** a deposit hold → needs a real Stripe customer and payment
 *     method. The failure state, the copy and the update-card guidance are
 *     verifiable; the retry itself will report the server's refusal.
 *
 *   Both are worth running anyway: seeing the server's refusal rendered
 *   correctly is itself a check, and it is the same code path a real failure
 *   takes.
 *
 * Usage:
 *   DATABASE_URL=... bun run seed:rental-lifecycle -- you@example.com
 *   DATABASE_URL=... LIFECYCLE_FIXTURE_EMAIL=you@example.com bun run seed:rental-lifecycle
 */

import "dotenv/config";
import { eq, inArray, like, ne } from "drizzle-orm";

import { db } from "../db-seed";
import { listingAvailability, listings } from "../schemas/listings.schema";
import { rentalPaymentLifecycle } from "../schemas/rental-payment-lifecycle.schema";
import { rentals, rentalRequests } from "../schemas/rentals.schema";
import { user } from "../schemas/user.schema";

/**
 * Distinct from `seed:schedule`'s tag so the two can be re-run and cleared
 * independently. Both may be seeded at once — they are additive by design, and a
 * tester will see both sets on Schedule.
 */
const TAG = "[lifecycle-fixture]";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A day offset from today, at local midnight — matching how the app books. */
function day(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** An instant `hours` from now — for deadlines, unlike `day` which is a date. */
function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * HOUR);
}

async function resolveTargetUser(email: string) {
  const [target] = await db
    .select({ id: user.id, email: user.email, firstName: user.firstName })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!target) {
    throw new Error(
      `No user with email "${email}". Sign in on the device once first, or pass the email you actually use.`,
    );
  }
  return target;
}

async function resolveCounterparty(targetId: string) {
  const [other] = await db
    .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(ne(user.id, targetId))
    .limit(1);
  if (!other) {
    throw new Error(
      "Need at least one other user to act as counterparty. Run `bun run seed` against a LOCAL database first.",
    );
  }
  return other;
}

type SeedListing = {
  id: string;
  dailyRate: string;
  securityDeposit: string | null;
};

async function resolveListings(targetId: string) {
  const columns = {
    id: listings.id,
    dailyRate: listings.dailyRate,
    securityDeposit: listings.securityDeposit,
  };
  const [mine] = await db
    .select(columns)
    .from(listings)
    .where(eq(listings.ownerId, targetId))
    .limit(1);
  const [theirs] = await db
    .select(columns)
    .from(listings)
    .where(ne(listings.ownerId, targetId))
    .limit(1);

  if (!mine || !theirs) {
    throw new Error(
      `Need a listing owned by ${targetId} (owner-side fixtures) and one owned by someone else (renter-side fixtures and the checkout picker). Found owned=${mine ? 1 : 0}, other=${theirs ? 1 : 0}.`,
    );
  }
  return { mine, theirs };
}

/** Remove this script's previous rows, and only those. */
async function clearPreviousFixtures(): Promise<void> {
  const tagged = await db
    .select({ id: rentalRequests.id })
    .from(rentalRequests)
    .where(like(rentalRequests.message, `%${TAG}%`));

  if (tagged.length > 0) {
    const ids = tagged.map((r) => r.id);
    const owned = await db
      .select({ id: rentals.id })
      .from(rentals)
      .where(inArray(rentals.requestId, ids));
    // `rental_payment_lifecycle` FKs `rentals`, which FKs `rental_requests`, so
    // the chain is deleted innermost first.
    if (owned.length > 0) {
      await db.delete(rentalPaymentLifecycle).where(
        inArray(
          rentalPaymentLifecycle.rentalId,
          owned.map((r) => r.id),
        ),
      );
    }
    await db.delete(rentals).where(inArray(rentals.requestId, ids));
    await db.delete(rentalRequests).where(inArray(rentalRequests.id, ids));
  }

  const blocks = await db
    .delete(listingAvailability)
    .where(like(listingAvailability.reason, `%${TAG}%`))
    .returning({ id: listingAvailability.id });

  console.log(
    `🧹 Removed ${tagged.length} tagged rental(s) and ${blocks.length} tagged availability block(s) from a previous run`,
  );
}

type DepositState =
  | "scheduled"
  | "held"
  | "released"
  | "failed"
  | "captured"
  | "not_applicable";

type Fixture = {
  label: string;
  /** What this fixture exists to make checkable. */
  verifies: string;
  listing: SeedListing;
  ownerId: string;
  renterId: string;
  startOffset: number;
  endOffset: number;
  status: "pending" | "approved" | "active" | "completed" | "overdue";
  /** Hours from now, for a pending request's live countdown. */
  expiresInHours?: number;
  /** Written to `rental_payment_lifecycle`; omitted leaves no row at all. */
  deposit?: DepositState;
  /** An approved rental whose pickup is within 24h — the half-refund tier. */
  startsInHours?: number;
  condition?: { pickup?: string; returnNote?: string };
  damage?: { description: string; photos: string[] };
};

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.LIFECYCLE_FIXTURE_EMAIL;
  if (!email) {
    throw new Error(
      "Pass the device account's email: `bun run seed:rental-lifecycle -- you@example.com`",
    );
  }

  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0];
  console.log(`\n🔧 Rental-lifecycle fixtures (Epic 8A)`);
  console.log(`   database : ${host ?? "(unknown)"}`);
  console.log(`   account  : ${email}\n`);

  const target = await resolveTargetUser(email);
  const other = await resolveCounterparty(target.id);
  const { mine, theirs } = await resolveListings(target.id);

  await clearPreviousFixtures();

  const rate = (l: SeedListing) => l.dailyRate;
  const total = (l: SeedListing, days: number) =>
    (Number(l.dailyRate) * days).toFixed(2);

  const fixtures: Fixture[] = [
    // ── Owner side (8A.4, 8A.5) ──────────────────────────────────────────────
    {
      label: "L1 approved, STARTS TODAY (owner)",
      verifies: "8A.5 Start rental — the only fixture where the button appears",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 0,
      endOffset: 3,
      status: "approved",
      deposit: "held",
    },
    {
      label: "L2 approved, starts in 4 days (owner)",
      verifies: "8A.5 the 'not yet startable' explanation, with its date",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 4,
      endOffset: 7,
      status: "approved",
      deposit: "scheduled",
    },
    {
      label: "L3 active (owner)",
      verifies: "8A.5 Confirm return, damage report + photo upload",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: -2,
      endOffset: 2,
      status: "active",
      deposit: "held",
    },
    {
      label: "L4 completed with condition + damage (owner)",
      verifies: "8A.5 condition read-back, damage photos, payout timeline",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: -9,
      endOffset: -2,
      status: "completed",
      deposit: "released",
      condition: {
        pickup: "Handed over working. Scuff on the handle, noted at pickup.",
        returnNote: "Came back on time. Housing cracked on the left side.",
      },
      damage: {
        description:
          "Cracked housing on the left side — not present at pickup. Still runs.",
        // Placeholder images: the point is that the grid renders remote URLs at
        // all, which is what a device check can confirm and a unit test cannot.
        photos: [
          "https://placehold.co/800x600/png?text=Damage+1",
          "https://placehold.co/800x600/png?text=Damage+2",
        ],
      },
    },

    // ── Renter side (8A.2, 8A.3) ─────────────────────────────────────────────
    {
      label: "L5 pending as RENTER, 70h left",
      verifies: "8A.2 countdown · 8A.3 pending cancel (no charge tier)",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: 10,
      endOffset: 12,
      status: "pending",
      expiresInHours: 70,
    },
    {
      label: "L6 approved, pickup in 6 HOURS (renter)",
      verifies: "8A.3 half-refund tier — the one a renter least expects",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: 0,
      endOffset: 2,
      status: "approved",
      startsInHours: 6,
      deposit: "held",
    },
    {
      label: "L7 approved, pickup in 5 days (renter)",
      verifies: "8A.3 full-refund tier, and its tierExpiresAt line",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: 5,
      endOffset: 8,
      status: "approved",
      deposit: "scheduled",
    },
    {
      label: "L8 approved, deposit hold FAILED (renter)",
      verifies:
        "8A.3 retry + update-card guidance — UNREACHABLE through the app",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: 3,
      endOffset: 6,
      status: "approved",
      deposit: "failed",
    },
    {
      label: "L9 completed, deposit CAPTURED (renter)",
      verifies: "8A.2 the one hold state that means money moved, via a dispute",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: -20,
      endOffset: -14,
      status: "completed",
      deposit: "captured",
    },
  ];

  for (const f of fixtures) {
    const days = Math.max(1, f.endOffset - f.startOffset + 1);
    // `startsInHours` overrides the day offset so a pickup can be placed inside
    // the 24-hour refund boundary, which a whole-day offset cannot express.
    const startDate =
      f.startsInHours !== undefined
        ? hoursFromNow(f.startsInHours)
        : day(f.startOffset);

    const [req] = await db
      .insert(rentalRequests)
      .values({
        listingId: f.listing.id,
        renterId: f.renterId,
        ownerId: f.ownerId,
        startDate,
        endDate: day(f.endOffset),
        totalDays: days,
        dailyRate: rate(f.listing),
        totalAmount: total(f.listing, days),
        securityDeposit: f.listing.securityDeposit ?? "0.00",
        deliveryRequested: false,
        deliveryFee: "0.00",
        setupRequested: false,
        setupFee: "0.00",
        serviceFee: (Number(total(f.listing, days)) * 0.1).toFixed(2),
        // Populated so the owner's earnings preview (Req 10.1.1) has something
        // to itemize rather than falling back to "confirmed at approval".
        applicationFeeAmount: (Number(total(f.listing, days)) * 0.3).toFixed(2),
        ownerPayout: (Number(total(f.listing, days)) * 0.8).toFixed(2),
        message: `${TAG} ${f.label}`,
        status: f.status,
        approvedAt:
          f.status === "pending" ? null : new Date(Date.now() - 2 * DAY),
        expiresAt: hoursFromNow(f.expiresInHours ?? 72),
      })
      .returning({ id: rentalRequests.id });

    if (f.status === "pending") {
      console.log(`   ✅ ${f.label}\n      ↳ ${f.verifies}`);
      continue;
    }

    const [rental] = await db
      .insert(rentals)
      .values({
        requestId: req.id,
        listingId: f.listing.id,
        renterId: f.renterId,
        ownerId: f.ownerId,
        startDate,
        endDate: day(f.endOffset),
        actualStartDate: ["active", "completed", "overdue"].includes(f.status)
          ? day(f.startOffset)
          : null,
        actualEndDate: f.status === "completed" ? day(f.endOffset) : null,
        // Recent, so 8A.5's payout-timeline explainer is inside its 24h window.
        returnConfirmedAt:
          f.status === "completed" ? new Date(Date.now() - 2 * HOUR) : null,
        totalAmount: total(f.listing, days),
        securityDeposit: f.listing.securityDeposit ?? "0.00",
        setupRequested: false,
        conditionAtPickup: f.condition?.pickup ?? null,
        conditionAtReturn: f.condition?.returnNote ?? null,
        damageReported: Boolean(f.damage),
        damageDescription: f.damage?.description ?? null,
        damagePhotos: f.damage?.photos ?? [],
        // No `status` here: `rentals` has no such column — the lifecycle status
        // lives on `rental_requests`. (`schedule-fixtures.seed.ts` passes one and
        // casts it away; not copied, and dropping the cast is what lets
        // TypeScript actually check this insert.)
      })
      .returning({ id: rentals.id });

    if (f.deposit) {
      await db.insert(rentalPaymentLifecycle).values({
        rentalId: rental.id,
        depositHoldStatus: f.deposit,
        depositHoldPlacedAt: ["held", "released", "captured"].includes(
          f.deposit,
        )
          ? new Date(Date.now() - 3 * DAY)
          : null,
        depositReleasedAt:
          f.deposit === "released" ? new Date(Date.now() - HOUR) : null,
        depositCapturedAt:
          f.deposit === "captured" ? new Date(Date.now() - 5 * DAY) : null,
      });
    }

    console.log(`   ✅ ${f.label}\n      ↳ ${f.verifies}`);
  }

  // ── Blocked days on a listing the tester does NOT own (8A.1) ──────────────
  // The checkout picker greys days out from `bookedRanges`, which merges
  // approved/active rentals with the owner's manual blocks. L5–L8 above supply
  // the rental half; this supplies the manual half, so a tester can see BOTH
  // sources and the reason text that only manual blocks carry.
  await db.insert(listingAvailability).values({
    listingId: theirs.id,
    startDate: day(20),
    endDate: day(23),
    isBlocked: true,
    reason: `Maintenance ${TAG}`,
  });
  console.log(
    `   ✅ L10 manual block on the borrowable listing, +20d → +23d\n      ↳ 8A.1 date picker greys these out and names the reason`,
  );

  console.log(`\n📋 Listing for checkout (8A.1): ${theirs.id}`);
  console.log(
    `   Open it from Browse and tap "Rent this item" — days +20…+23 carry a reason,`,
  );
  console.log(`   and the rentals above block their own days.\n`);
  console.log(`⚠️  Cannot be completed without real Stripe objects:`);
  console.log(
    `   · confirming a cancellation on L6/L7 (the TIER is verifiable; the refund is not)`,
  );
  console.log(
    `   · the retry on L8 (the failure state and guidance are verifiable)\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Rental-lifecycle fixtures failed:", error);
    process.exit(1);
  });

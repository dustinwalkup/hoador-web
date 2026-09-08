/**
 * Service-booking device-verification fixtures (mobile Epic 9).
 *
 * `seed:schedule` puts service bookings on the Schedule, and `seed:rental-
 * lifecycle` covers the rental half of the detail surfaces. Neither reaches
 * what Epic 9.2 built, and this covers those:
 *
 *   - **`payment_failed`** — the provider's retry, its F12 guidance, and the
 *     "you are not charged" line surviving a failed charge. **Cannot be produced
 *     by using the app**: it needs a card that declines an off-session charge,
 *     so without a fixture that whole branch ships unverified.
 *   - **an accepted booking with `accepted_at: null`** — what every booking
 *     written before the P-E9-4 migration looks like, and the only way to see
 *     the Timeline render *a stage that happened without a timestamp*. Also
 *     unreachable through the app, which now always writes the column.
 *   - **an accepted booking inside 24 hours** — the half-refund tier, which is
 *     half of the *service price* rather than half the total (F3) and is the
 *     refund a client is least likely to expect.
 *   - **an accepted booking days out** — the full-refund tier and its
 *     "applies until…" line, from `tierExpiresAt`.
 *   - **a declined booking with a reason**, and **a cancelled one with a
 *     refund** — the two terminal Timeline branches and the refund row.
 *   - **a fixed-price booking** — the pricing section's no-rate-note branch,
 *     which every hourly fixture hides.
 *
 * **This script is ADDITIVE. It never truncates.** Same rule and same reason as
 * its two siblings: `seed.ts` truncates ~45 tables including `user` and
 * `session`, which against a shared environment would destroy the Stripe Connect
 * account from task 7.2.2 and every live session. This tags its own rows and
 * replaces only those.
 *
 * ⚠️ **What these fixtures CANNOT make verifiable.** Anything needing a real
 * Stripe object fails where it reaches Stripe, and no seed fixes that:
 *
 *   - **Accepting** any of these → the charge needs a real customer and payment
 *     method. The accept *sheet*, the earnings preview above it and the JIT
 *     payout gate are all verifiable; the charge itself will report the
 *     server's refusal.
 *   - **Confirming** a cancellation on an accepted booking → the refund needs a
 *     real charge. The **tier and the amounts are still verifiable**, and that
 *     is the part Req 11.1.5 is about — it is a pure read.
 *
 *   Both are worth running anyway: seeing the server's refusal rendered
 *   correctly is itself a check, and it is the same path a real failure takes.
 *
 * Usage:
 *   DATABASE_URL=... bun run seed:service-lifecycle -- you@example.com
 *   DATABASE_URL=... LIFECYCLE_FIXTURE_EMAIL=you@example.com bun run seed:service-lifecycle
 */

import "dotenv/config";
import { eq, inArray, like, ne } from "drizzle-orm";

import { calculateServiceFee } from "../../constants/payments";
import { db } from "../db-seed";
import { servicePaymentLifecycle } from "../schemas/service-payment-lifecycle.schema";
import { serviceBookings, serviceListings } from "../schemas/services.schema";
import { user } from "../schemas/user.schema";

/**
 * Distinct from the other two seeds' tags so all three can be re-run and
 * cleared independently. They are additive by design and may coexist.
 */
const TAG = "[service-fixture]";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A day offset from today as `YYYY-MM-DD` — the wall-clock form the column holds. */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** `HH:MM` this many hours from now, as a wall clock in the machine's own zone. */
function timeInHours(hours: number): { date: string; time: string } {
  const at = new Date(Date.now() + hours * HOUR);
  return {
    date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
      at.getDate(),
    ).padStart(2, "0")}`,
    time: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
  };
}

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
  communityId: string;
  providerId: string;
  price: string;
  pricingType: "fixed" | "hourly";
};

async function resolveListings(targetId: string) {
  const columns = {
    id: serviceListings.id,
    communityId: serviceListings.communityId,
    providerId: serviceListings.providerId,
    price: serviceListings.price,
    pricingType: serviceListings.pricingType,
  };
  const [mine] = await db
    .select(columns)
    .from(serviceListings)
    .where(eq(serviceListings.providerId, targetId))
    .limit(1);
  const [theirs] = await db
    .select(columns)
    .from(serviceListings)
    .where(ne(serviceListings.providerId, targetId))
    .limit(1);

  if (!mine || !theirs) {
    throw new Error(
      `Need a service listing provided by ${targetId} (provider-side fixtures) and one provided by someone else (client-side fixtures, and the booking flow 9.1 will need it too). Found mine=${mine ? 1 : 0}, theirs=${theirs ? 1 : 0}. Run \`bun run seed:service-listings\` first.`,
    );
  }
  return { mine: mine as SeedListing, theirs: theirs as SeedListing };
}

/** Remove this script's previous rows, and only those. */
async function clearPreviousFixtures(): Promise<void> {
  const tagged = await db
    .select({ id: serviceBookings.id })
    .from(serviceBookings)
    .where(like(serviceBookings.notes, `%${TAG}%`));

  if (tagged.length > 0) {
    const ids = tagged.map((r) => r.id);
    // `service_payment_lifecycle` FKs `service_bookings`, so it goes first.
    await db
      .delete(servicePaymentLifecycle)
      .where(inArray(servicePaymentLifecycle.bookingId, ids));
    await db.delete(serviceBookings).where(inArray(serviceBookings.id, ids));
  }

  console.log(
    `🧹 Removed ${tagged.length} tagged booking(s) from a previous run`,
  );
}

type Fixture = {
  label: string;
  /** What this fixture exists to make checkable. */
  verifies: string;
  listing: SeedListing;
  providerId: string;
  requesterId: string;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "payment_failed"
    | "completed"
    | "cancelled";
  /** Whole days out; overridden by `startsInHours`. */
  dayOffset: number;
  /** Places the job inside the 24-hour refund boundary, which a day cannot. */
  startsInHours?: number;
  hours?: number | null;
  /** Hours from now, for a pending booking's live countdown. */
  expiresInHours?: number;
  /** Forces the P-E9-4 backfill shape: accepted, but with no recorded moment. */
  omitAcceptedAt?: boolean;
  declineReason?: string;
  refundAmount?: string;
  cancelledByRequester?: boolean;
  /** Written to `service_payment_lifecycle`; omitted leaves no row at all. */
  payout?: {
    status: "pending" | "completed";
    transfer: "pending" | "completed";
  };
  /** Overrides the listing's own pricing, for the fixed-price fixture. */
  fixedPrice?: string;
};

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.LIFECYCLE_FIXTURE_EMAIL;
  if (!email) {
    throw new Error(
      "Pass the device account's email: `bun run seed:service-lifecycle -- you@example.com`",
    );
  }

  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0];
  console.log(`\n🔧 Service-booking fixtures (Epic 9)`);
  console.log(`   database : ${host ?? "(unknown)"}`);
  console.log(`   account  : ${email}\n`);

  const target = await resolveTargetUser(email);
  const other = await resolveCounterparty(target.id);
  const { mine, theirs } = await resolveListings(target.id);

  await clearPreviousFixtures();

  const fixtures: Fixture[] = [
    // ── Provider side (9.2's actions) ────────────────────────────────────────
    {
      label: "S1 pending as PROVIDER, 70h left",
      verifies:
        "9.2 accept sheet + earnings preview · decline sheet · inline decline from Needs Your Attention · the JIT payout gate",
      listing: mine,
      providerId: target.id,
      requesterId: other.id,
      status: "pending",
      dayOffset: 6,
      hours: 3,
      expiresInHours: 70,
    },
    {
      label: "S2 PAYMENT FAILED as provider",
      verifies:
        "9.2 the retry path and F12's guidance — UNREACHABLE through the app",
      listing: mine,
      providerId: target.id,
      requesterId: other.id,
      status: "payment_failed",
      dayOffset: 4,
      hours: 2,
    },
    {
      label: "S3 accepted as PROVIDER",
      verifies:
        "9.2 Mark complete + its payout explainer · provider cancel (full refund) · the no-show pointer",
      listing: mine,
      providerId: target.id,
      requesterId: other.id,
      status: "accepted",
      dayOffset: 3,
      hours: 4,
      payout: { status: "pending", transfer: "pending" },
    },
    {
      label: "S4 accepted as provider, NO accepted_at",
      verifies:
        "9.2 the Timeline rendering a stage that happened WITHOUT a timestamp — every pre-P-E9-4 row looks like this, and the app can no longer create one",
      listing: mine,
      providerId: target.id,
      requesterId: other.id,
      status: "accepted",
      dayOffset: 8,
      hours: 2,
      omitAcceptedAt: true,
      payout: { status: "pending", transfer: "pending" },
    },
    {
      label: "S5 completed as provider",
      verifies: "9.2 the full Timeline, and earnings in the past tense",
      listing: mine,
      providerId: target.id,
      requesterId: other.id,
      status: "completed",
      dayOffset: -5,
      hours: 3,
      payout: { status: "completed", transfer: "completed" },
    },

    // ── Client side (9.2's cancel, and 9.1 later) ────────────────────────────
    {
      label: "S6 pending as CLIENT, 70h left",
      verifies:
        "9.2 countdown · cancel at no charge (pending_no_charge tier) · 'nothing is charged unless the provider accepts'",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "pending",
      dayOffset: 9,
      hours: 2,
      expiresInHours: 70,
    },
    {
      label: "S7 accepted as CLIENT, job in 6 HOURS",
      verifies:
        "9.2 the HALF-refund tier — half the SERVICE PRICE, not half the total (F3), and the provider's disclosed share",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "accepted",
      dayOffset: 0,
      startsInHours: 6,
      hours: 3,
      payout: { status: "pending", transfer: "pending" },
    },
    {
      label: "S8 accepted as CLIENT, job in 5 days",
      verifies: "9.2 the FULL-refund tier and its 'applies until…' line",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "accepted",
      dayOffset: 5,
      hours: 2,
      payout: { status: "pending", transfer: "pending" },
    },
    {
      label: "S9 declined as client, with a reason",
      verifies:
        "9.2 the decline-reason section and the Declined Timeline branch",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "declined",
      dayOffset: -2,
      hours: 2,
      declineReason: "Fully booked that morning — try me later in the week?",
    },
    {
      label: "S10 cancelled as client, refunded",
      verifies: "9.2 the refund row, and the Cancelled Timeline branch",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "cancelled",
      dayOffset: -6,
      hours: 2,
      refundAmount: "60.00",
      cancelledByRequester: true,
    },
    {
      label: "S11 FIXED-PRICE booking as client",
      verifies:
        "9.2 the pricing section with no rate note — every hourly fixture hides that branch",
      listing: theirs,
      providerId: theirs.providerId,
      requesterId: target.id,
      status: "accepted",
      dayOffset: 12,
      hours: null,
      fixedPrice: "85.00",
      payout: { status: "pending", transfer: "pending" },
    },
  ];

  for (const f of fixtures) {
    const hourly = f.hours != null && f.fixedPrice === undefined;
    const rate = Number(f.fixedPrice ?? f.listing.price);
    const servicePrice = f.fixedPrice
      ? Number(f.fixedPrice)
      : Math.round(rate * (f.hours ?? 1) * 100) / 100;
    // The same function the server charges from, so a fixture cannot quote a
    // total the app would then render differently.
    const serviceFee = calculateServiceFee(servicePrice);
    const totalAmount = Math.round((servicePrice + serviceFee) * 100) / 100;

    const when =
      f.startsInHours !== undefined
        ? timeInHours(f.startsInHours)
        : { date: day(f.dayOffset), time: "09:00" };

    const charged = ["accepted", "completed", "cancelled"].includes(f.status);

    const [booking] = await db
      .insert(serviceBookings)
      .values({
        listingId: f.listing.id,
        requesterId: f.requesterId,
        providerId: f.providerId,
        communityId: f.listing.communityId,
        proposedDate: when.date,
        proposedTime: when.time,
        hours: hourly ? String(f.hours) : null,
        notes: `${TAG} ${f.label}`,
        declineReason: f.declineReason ?? null,
        servicePrice: servicePrice.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        status: f.status,
        // Deliberately fake: no Stripe object exists behind these, which is what
        // the header note says cannot be worked around. Present so the app takes
        // the "has been charged" branch.
        stripePaymentIntentId: charged ? `pi_fixture_${Date.now()}` : null,
        stripeChargeId: charged ? `ch_fixture_${Date.now()}` : null,
        paymentStatus: charged
          ? f.status === "cancelled"
            ? "refunded"
            : "succeeded"
          : f.status === "payment_failed"
            ? "failed"
            : null,
        refundAmount: f.refundAmount ?? null,
        cancelledAt:
          f.status === "cancelled" ? new Date(Date.now() - DAY) : null,
        cancelledBy:
          f.status === "cancelled"
            ? f.cancelledByRequester
              ? f.requesterId
              : f.providerId
            : null,
        cancellationReason: f.status === "cancelled" ? "Plans changed" : null,
        completedAt:
          f.status === "completed" ? new Date(Date.now() - 2 * HOUR) : null,
        // The point of S4: accepted, with the moment unrecorded.
        acceptedAt:
          charged && !f.omitAcceptedAt ? new Date(Date.now() - 2 * DAY) : null,
        declinedAt: f.status === "declined" ? new Date(Date.now() - DAY) : null,
        selectedPaymentMethodId: null,
        expiresAt: hoursFromNow(f.expiresInHours ?? 72),
      })
      .returning({ id: serviceBookings.id });

    if (f.payout) {
      await db.insert(servicePaymentLifecycle).values({
        bookingId: booking.id,
        chargeId: `ch_fixture_${booking.id.slice(0, 8)}`,
        // The stored split, so the provider's earnings render the value the
        // transfer would actually pay rather than "confirmed at acceptance".
        providerPayout: (Math.round(servicePrice * 0.8 * 100) / 100).toFixed(2),
        ownerTransferStatus: f.payout.transfer,
        payoutStatus: f.payout.status,
        ownerTransferredAt:
          f.payout.transfer === "completed"
            ? new Date(Date.now() - HOUR)
            : null,
        transferAmount:
          f.payout.transfer === "completed"
            ? (Math.round(servicePrice * 0.8 * 100) / 100).toFixed(2)
            : null,
      });
    }

    console.log(`   ✅ ${f.label}\n      ↳ ${f.verifies}`);
  }

  console.log(`\n✨ ${fixtures.length} service bookings seeded.`);
  console.log(
    `   Open Schedule on the device — every one of these is now tappable (9.2 wiring).\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Service-lifecycle fixtures failed:", error);
    process.exit(1);
  });

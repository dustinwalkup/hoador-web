/**
 * Schedule device-verification fixtures (mobile prerequisite **P-E8-3**).
 *
 * Covers the cases tasks 8.4–8.6 cannot be checked on a phone without: month
 * navigation needs activity spread across months, the interval-overlap query
 * needs a rental crossing a month boundary, and Needs Your Attention needs a
 * pending request whose 72-hour countdown is actually still running.
 *
 * **This script is ADDITIVE. It never truncates.**
 *
 * `seed.ts` opens with `TRUNCATE ... RESTART IDENTITY CASCADE` over ~45 tables
 * including `user`, `session` and `account`. Running that against a shared
 * environment would destroy the Stripe Connect account set up during task
 * 7.2.2's device verification, every test user, and every live session. This
 * script instead tags its own rows and replaces only those on re-run.
 *
 * **Re-run it before each device session.** Two fixtures carry a live
 * `expiresAt` and are genuinely perishable: after 72 hours the countdown reads
 * zero and the `expire-pending-bookings` cron cancels them — which is correct
 * production behaviour, not a bug to design around.
 *
 * Usage:
 *   DATABASE_URL=... bun run seed:schedule -- you@example.com
 *   DATABASE_URL=... SCHEDULE_FIXTURE_EMAIL=you@example.com bun run seed:schedule
 */

import "dotenv/config";
import { eq, inArray, like, ne, sql } from "drizzle-orm";

import { db } from "../db-seed";
import { rentals, rentalRequests } from "../schemas/rentals.schema";
import { listings } from "../schemas/listings.schema";
import { serviceBookings, serviceListings } from "../schemas/services.schema";
import { user } from "../schemas/user.schema";

/**
 * Marker written into a free-text column so a re-run can find and remove only
 * this script's rows. `message`/`notes` are used rather than a new column
 * because fixtures must not require a migration to exist.
 */
const TAG = "[schedule-fixture]";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A day offset from today, at local midnight — matching how the app books. */
function day(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** `YYYY-MM-DD` from local components — never `toISOString`, which shifts. */
function dayString(offset: number): string {
  const d = day(offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The first day of the month `n` months out — used to place a rental across a
 * month boundary, which is what actually exercises the overlap predicate
 * (`startDate <= to AND endDate >= from`) rather than plain containment.
 */
function daysUntilMonthEnd(): number {
  const now = new Date();
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.ceil((lastOfMonth.getTime() - now.getTime()) / DAY);
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

/** Someone to be on the other side of every fixture. */
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

async function resolveListings(targetId: string) {
  const owned = await db
    .select({
      id: listings.id,
      dailyRate: listings.dailyRate,
      securityDeposit: listings.securityDeposit,
    })
    .from(listings)
    .where(eq(listings.ownerId, targetId))
    .limit(1);
  const theirs = await db
    .select({
      id: listings.id,
      dailyRate: listings.dailyRate,
      securityDeposit: listings.securityDeposit,
    })
    .from(listings)
    .where(ne(listings.ownerId, targetId))
    .limit(1);

  if (!owned[0] || !theirs[0]) {
    throw new Error(
      `Need a listing owned by ${targetId} (for "lending to") and one owned by someone else (for "borrowing from"). Found owned=${owned.length}, other=${theirs.length}.`,
    );
  }
  return { mine: owned[0], theirs: theirs[0] };
}

async function resolveServiceListings(targetId: string) {
  const mine = await db
    .select({
      id: serviceListings.id,
      communityId: serviceListings.communityId,
      price: serviceListings.price,
    })
    .from(serviceListings)
    .where(eq(serviceListings.providerId, targetId))
    .limit(1);
  const theirs = await db
    .select({
      id: serviceListings.id,
      communityId: serviceListings.communityId,
      price: serviceListings.price,
      providerId: serviceListings.providerId,
    })
    .from(serviceListings)
    .where(ne(serviceListings.providerId, targetId))
    .limit(1);

  if (!theirs[0]) {
    throw new Error(
      "Need at least one service listing owned by someone other than the target user.",
    );
  }
  return { mine: mine[0] ?? null, theirs: theirs[0] };
}

/** Remove this script's previous rows, and only those. */
async function clearPreviousFixtures(): Promise<void> {
  const tagged = await db
    .select({ id: rentalRequests.id })
    .from(rentalRequests)
    .where(like(rentalRequests.message, `%${TAG}%`));

  if (tagged.length > 0) {
    const ids = tagged.map((r) => r.id);
    // `rentals` FKs `rental_requests`, so the child goes first.
    await db.delete(rentals).where(inArray(rentals.requestId, ids));
    await db.delete(rentalRequests).where(inArray(rentalRequests.id, ids));
  }

  const bookings = await db
    .delete(serviceBookings)
    .where(like(serviceBookings.notes, `%${TAG}%`))
    .returning({ id: serviceBookings.id });

  console.log(
    `🧹 Removed ${tagged.length} tagged rental(s) and ${bookings.length} tagged booking(s) from a previous run`,
  );
}

async function main(): Promise<void> {
  const email = process.argv[2] ?? process.env.SCHEDULE_FIXTURE_EMAIL;
  if (!email) {
    throw new Error(
      "Pass the device account's email: `bun run seed:schedule -- you@example.com`",
    );
  }

  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0];
  console.log(`\n📅 Schedule fixtures (P-E8-3)`);
  console.log(`   database : ${host ?? "(unknown)"}`);
  console.log(`   account  : ${email}\n`);

  const target = await resolveTargetUser(email);
  const other = await resolveCounterparty(target.id);
  const rentalListings = await resolveListings(target.id);
  const svc = await resolveServiceListings(target.id);

  await clearPreviousFixtures();

  const toMonthEnd = daysUntilMonthEnd();
  const rate = (l: { dailyRate: string }) => l.dailyRate;
  const total = (l: { dailyRate: string }, days: number) =>
    (Number(l.dailyRate) * days).toFixed(2);

  type Fixture = {
    label: string;
    listing: { id: string; dailyRate: string; securityDeposit: string | null };
    ownerId: string;
    renterId: string;
    startOffset: number;
    endOffset: number;
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied";
    /** Hours from now; only meaningful while pending. */
    expiresInHours: number;
  };

  const mine = rentalListings.mine;
  const theirs = rentalListings.theirs;

  const rentalFixtures: Fixture[] = [
    {
      label: "1  pending as OWNER — live 70h countdown, Review/Decline",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 10,
      endOffset: 12,
      status: "pending",
      expiresInHours: 70,
    },
    {
      label: "2  pending as RENTER — must NOT appear in Needs Attention",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: 14,
      endOffset: 16,
      status: "pending",
      expiresInHours: 60,
    },
    {
      label: `3  approved, SPANS A MONTH BOUNDARY (+${toMonthEnd - 1}d → +${toMonthEnd + 3}d)`,
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: toMonthEnd - 1,
      endOffset: toMonthEnd + 3,
      status: "approved",
      expiresInHours: 0,
    },
    {
      label: "4  active, spanning today",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: -2,
      endOffset: 3,
      status: "active",
      expiresInHours: 0,
    },
    {
      label: "5  overdue — attention class + Overdue treatment",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: -9,
      endOffset: -2,
      status: "overdue",
      expiresInHours: 0,
    },
    {
      label: "6  same-day — moments collapse to pickup only",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 5,
      endOffset: 5,
      status: "approved",
      expiresInHours: 0,
    },
    {
      label: "7  completed ~2 months ago — past-month navigation",
      listing: theirs,
      ownerId: other.id,
      renterId: target.id,
      startOffset: -62,
      endOffset: -58,
      status: "completed",
      expiresInHours: 0,
    },
    {
      label: "8  cancelled, next month — muted treatment",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 40,
      endOffset: 43,
      status: "cancelled",
      expiresInHours: 0,
    },
    {
      label: "9  denied, +3 months — forward month navigation",
      listing: mine,
      ownerId: target.id,
      renterId: other.id,
      startOffset: 92,
      endOffset: 95,
      status: "denied",
      expiresInHours: 0,
    },
  ];

  for (const f of rentalFixtures) {
    const days = Math.max(1, f.endOffset - f.startOffset + 1);
    const [req] = await db
      .insert(rentalRequests)
      .values({
        listingId: f.listing.id,
        renterId: f.renterId,
        ownerId: f.ownerId,
        startDate: day(f.startOffset),
        endDate: day(f.endOffset),
        totalDays: days,
        dailyRate: rate(f.listing),
        totalAmount: total(f.listing, days),
        securityDeposit: f.listing.securityDeposit ?? "0.00",
        deliveryRequested: false,
        deliveryFee: "0.00",
        setupRequested: false,
        setupFee: "0.00",
        message: `${TAG} ${f.label}`,
        status: f.status,
        approvedAt: ["approved", "active", "completed", "overdue"].includes(
          f.status,
        )
          ? new Date(Date.now() - 3 * DAY)
          : null,
        deniedAt: f.status === "denied" ? new Date(Date.now() - 2 * DAY) : null,
        expiresAt: new Date(Date.now() + (f.expiresInHours || 72) * HOUR),
      })
      .returning({ id: rentalRequests.id });

    // The lifecycle statuses that imply a real rental row get one, matching
    // what `rentals.seed.ts` does — otherwise detail screens have nothing to read.
    if (["approved", "active", "completed", "overdue"].includes(f.status)) {
      await db.insert(rentals).values({
        requestId: req.id,
        listingId: f.listing.id,
        renterId: f.renterId,
        ownerId: f.ownerId,
        startDate: day(f.startOffset),
        endDate: day(f.endOffset),
        actualStartDate: ["active", "completed", "overdue"].includes(f.status)
          ? day(f.startOffset)
          : null,
        actualEndDate: f.status === "completed" ? day(f.endOffset) : null,
        totalAmount: total(f.listing, days),
        securityDeposit: f.listing.securityDeposit ?? "0.00",
        setupRequested: false,
        status: f.status === "overdue" ? "overdue" : f.status,
      } as typeof rentals.$inferInsert);
    }
    console.log(`   ✅ rental   ${f.label}`);
  }

  // ── Service bookings — the half of Schedule nothing seeds today ───────────
  // Without these, every TIMED event goes unverified on device: rentals are
  // all-day spans, so the whole timed path (D17), the nullable-duration rule
  // (Req 2.8.4) and the `payment_failed` attention class have no coverage.
  const providerListing = svc.mine;
  const clientListing = svc.theirs;

  type BookingFixture = {
    label: string;
    listingId: string;
    communityId: string;
    price: string;
    providerId: string;
    requesterId: string;
    dayOffset: number;
    time: string;
    hours: string | null;
    status:
      | "pending"
      | "accepted"
      | "declined"
      | "payment_failed"
      | "completed"
      | "cancelled";
    expiresInHours: number;
  };

  const bookingFixtures: BookingFixture[] = [
    {
      label: "10 accepted as CLIENT, 1.5h — timed block WITH an end",
      listingId: clientListing.id,
      communityId: clientListing.communityId,
      price: clientListing.price,
      providerId: clientListing.providerId,
      requesterId: target.id,
      dayOffset: 3,
      time: "10:00",
      hours: "1.50",
      status: "accepted",
      expiresInHours: 0,
    },
    {
      label: "11 accepted as CLIENT, hours=NULL — start only, never a range",
      listingId: clientListing.id,
      communityId: clientListing.communityId,
      price: clientListing.price,
      providerId: clientListing.providerId,
      requesterId: target.id,
      dayOffset: 6,
      time: "14:30",
      hours: null,
      status: "accepted",
      expiresInHours: 0,
    },
    {
      label:
        "12 payment_failed as CLIENT — the attention class the boards omit",
      listingId: clientListing.id,
      communityId: clientListing.communityId,
      price: clientListing.price,
      providerId: clientListing.providerId,
      requesterId: target.id,
      dayOffset: 8,
      time: "09:00",
      hours: "2.00",
      status: "payment_failed",
      expiresInHours: 0,
    },
    {
      label: "13 accepted as CLIENT, +45d — next-month timed event",
      listingId: clientListing.id,
      communityId: clientListing.communityId,
      price: clientListing.price,
      providerId: clientListing.providerId,
      requesterId: target.id,
      dayOffset: 45,
      time: "11:15",
      hours: "3.00",
      status: "accepted",
      expiresInHours: 0,
    },
  ];

  // Only possible if the target actually provides a service — otherwise the
  // provider-side role label and the service request queue can't be shown.
  if (providerListing) {
    bookingFixtures.push(
      {
        label:
          "14 pending as PROVIDER — service Review/Decline + live countdown",
        listingId: providerListing.id,
        communityId: providerListing.communityId,
        price: providerListing.price,
        providerId: target.id,
        requesterId: other.id,
        dayOffset: 4,
        time: "13:00",
        hours: "1.00",
        status: "pending",
        expiresInHours: 68,
      },
      {
        label: '15 accepted as PROVIDER — "Providing to …" role label',
        listingId: providerListing.id,
        communityId: providerListing.communityId,
        price: providerListing.price,
        providerId: target.id,
        requesterId: other.id,
        dayOffset: -20,
        time: "08:30",
        hours: "2.50",
        status: "completed",
        expiresInHours: 0,
      },
    );
  } else {
    console.log(
      "   ⚠️  Target user provides no service listing — skipping provider-side booking fixtures (14, 15).",
    );
    console.log(
      "      Create one in the app, or run against a database seeded with `bun run seed`.",
    );
  }

  for (const b of bookingFixtures) {
    const serviceFee = (Number(b.price) * 0.1).toFixed(2);
    await db.insert(serviceBookings).values({
      listingId: b.listingId,
      requesterId: b.requesterId,
      providerId: b.providerId,
      communityId: b.communityId,
      proposedDate: dayString(b.dayOffset),
      proposedTime: b.time,
      hours: b.hours,
      notes: `${TAG} ${b.label}`,
      servicePrice: b.price,
      serviceFee,
      totalAmount: (Number(b.price) + Number(serviceFee)).toFixed(2),
      status: b.status,
      expiresAt: new Date(Date.now() + (b.expiresInHours || 72) * HOUR),
    } as typeof serviceBookings.$inferInsert);
    console.log(`   ✅ booking  ${b.label}`);
  }

  const [{ count: rentalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rentalRequests)
    .where(like(rentalRequests.message, `%${TAG}%`));
  const [{ count: bookingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceBookings)
    .where(like(serviceBookings.notes, `%${TAG}%`));

  console.log(
    `\n🎉 ${rentalCount} rentals + ${bookingCount} service bookings for ${email}`,
  );
  console.log(
    `   Perishable: the pending fixtures expire in ~70h. Re-run before the next device session.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Schedule fixtures failed:", err.message ?? err);
    process.exit(1);
  });

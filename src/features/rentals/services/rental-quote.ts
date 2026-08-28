import { listingDAL, rentalDAL } from "@/dal";
import { NotFoundError } from "@/dal/errors";
import {
  findConflict,
  isPastDay,
  toBookedRanges,
  type BookedRange,
} from "@/features/rentals/lib/availability";
import {
  calculateRentalPricing,
  type RentalPricing,
  type RentalPricingListingInput,
} from "@/features/rentals/lib/pricing";
import { differenceInDays } from "@/lib/utils/date.utils";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * The single pre-flight for a rental request: **price it and say whether it can
 * be booked**, without creating anything.
 *
 * This is not a new calculation. It is the prelude that already lived inside
 * `RentalService.createRentalRequest` — fetch the listing, block own-listings,
 * derive `totalDays`, check the period bounds, call `calculateRentalPricing` —
 * lifted out so a *preview* and the *charge* run the same code rather than two
 * implementations that agree until they don't (mobile D-E8A-1, P-E8A-1).
 *
 * That mattered enough to be worth the extraction: the web checkout currently
 * does this arithmetic a second time in the browser
 * (`rent-listing-page-content.tsx`), and a mobile binary that cannot be
 * hot-fixed would have been a third. A quoted total that differs from the
 * charged total is the most damaging bug available in this flow.
 *
 * **Blockers are returned, not thrown.** A preview needs to render *why* a date
 * range is unbookable — Req 9.1.6 asks for own-listing to be an explanation
 * rather than a disabled button — so the caller decides whether a blocker is
 * fatal. `createRentalRequest` throws on the first one; the preview route ships
 * the list.
 */

export type QuoteBlockerCode =
  | "OWN_LISTING"
  | "END_BEFORE_START"
  | "START_IN_PAST"
  | "BELOW_MINIMUM_PERIOD"
  | "ABOVE_MAXIMUM_PERIOD"
  | "DATES_UNAVAILABLE";

export interface QuoteBlocker {
  /** Stable, for the client to branch on — never the message (mobile rule #8). */
  code: QuoteBlockerCode;
  /** Rendered verbatim. The web's existing copy, preserved to the character. */
  message: string;
  /** Set on DATES_UNAVAILABLE: the window that clashes. */
  conflict?: BookedRange;
}

export interface RentalQuoteInput {
  listingId: string;
  startDate: Date;
  endDate: Date;
  deliveryRequested?: boolean;
  setupRequested?: boolean;
  /** Override; the listing's own setup fee is used when absent. */
  setupFee?: number | null;
}

export interface RentalQuote {
  listingId: string;
  listingName: string;
  ownerId: string;
  totalDays: number;
  pricing: RentalPricing;
  canBook: boolean;
  blockers: QuoteBlocker[];
  bookedRanges: BookedRange[];
  minimumRentalPeriod: number;
  maximumRentalPeriod: number;
  securityDepositIsHold: true;
}

/**
 * Price and validate a prospective rental.
 *
 * @throws NotFoundError when the listing does not exist. Everything else the
 *   caller can act on comes back as a blocker.
 */
export async function quoteRentalRequest(
  input: RentalQuoteInput,
  userId: string,
  options: { now?: Date } = {},
): Promise<RentalQuote> {
  // No viewer id: `getListingById` increments `viewCount` when given one, and a
  // price check is not a view. `createRentalRequest` reads it the same way.
  const listing = await listingDAL.getListingById(input.listingId);
  if (!listing) throw new NotFoundError("Listing", input.listingId);

  const deliveryRequested = input.deliveryRequested ?? false;
  const setupRequested = input.setupRequested ?? false;
  const totalDays = differenceInDays(input.endDate, input.startDate) + 1;

  // Availability degrades to "unknown" rather than failing the quote: a price is
  // still useful, and the clash re-checks at submit where it is authoritative.
  const { data: blocked } = await tryCatch(
    (async () => rentalDAL.getBookedDatesForListing(input.listingId))(),
  );
  const bookedRanges = toBookedRanges(blocked ?? []);

  const blockers: QuoteBlocker[] = [];

  // Req 9.1.6. Message preserved verbatim from `createRentalRequest`.
  if (listing.owner.id === userId) {
    blockers.push({
      code: "OWN_LISTING",
      message: "Cannot rent your own listing",
    });
  }

  if (totalDays < 1) {
    blockers.push({
      code: "END_BEFORE_START",
      message: "End date must be on or after start date",
    });
  }

  if (isPastDay(input.startDate, options.now)) {
    blockers.push({
      code: "START_IN_PAST",
      message: "Start date cannot be in the past",
    });
  }

  if (totalDays >= 1 && totalDays < listing.minimumRentalPeriod) {
    blockers.push({
      code: "BELOW_MINIMUM_PERIOD",
      message: `Minimum rental period is ${listing.minimumRentalPeriod} day(s)`,
    });
  }
  if (totalDays > listing.maximumRentalPeriod) {
    blockers.push({
      code: "ABOVE_MAXIMUM_PERIOD",
      message: `Maximum rental period is ${listing.maximumRentalPeriod} days`,
    });
  }

  // A failed availability read is "unknown", not "clear": no clash is reported
  // and the submit-time check stays authoritative.
  const conflict = blocked
    ? findConflict(blocked, input.startDate, input.endDate)
    : null;
  if (conflict) {
    blockers.push({
      code: "DATES_UNAVAILABLE",
      message: conflict.reason
        ? `Those dates are unavailable (${conflict.reason})`
        : "Those dates are already booked",
      conflict,
    });
  }

  const pricingListing: RentalPricingListingInput = {
    dailyRate: String(listing.dailyRate),
    weeklyRate: listing.weeklyRate != null ? String(listing.weeklyRate) : null,
    monthlyRate:
      listing.monthlyRate != null ? String(listing.monthlyRate) : null,
    deliveryFee: String(listing.deliveryFee),
    setupFee: String(listing.setupFee),
    securityDeposit: String(listing.securityDeposit),
  };

  const pricing = calculateRentalPricing({
    listing: pricingListing,
    // A nonsensical range still returns a shape rather than throwing, so the
    // client can render blockers beside a zeroed summary instead of an error page.
    totalDays: Math.max(totalDays, 0),
    deliveryRequested,
    setupRequested,
    setupFee: input.setupFee,
  });

  return {
    listingId: listing.id,
    listingName: listing.name,
    ownerId: listing.owner.id,
    totalDays,
    pricing,
    canBook: blockers.length === 0,
    blockers,
    bookedRanges,
    minimumRentalPeriod: listing.minimumRentalPeriod,
    maximumRentalPeriod: listing.maximumRentalPeriod,
    // The deposit is an authorization that is released, never money taken
    // (mobile rule #4, Req 14.1). Stated in the payload so no client has to
    // remember it.
    securityDepositIsHold: true,
  };
}

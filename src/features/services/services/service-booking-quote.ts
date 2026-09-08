import { serviceListingDAL } from "@/dal";
import { NotFoundError } from "@/dal/errors";
import { calculateServiceFee } from "@/constants/payments";
import { MARKET_TIME_ZONE } from "@/lib/wall-clock-zone";

/**
 * The single pre-flight for a service booking: **price it and say whether it
 * can be booked**, without creating anything.
 *
 * This is not a new calculation. It is the prelude that already lived inside
 * `ServiceBookingService.createBooking` — fetch the listing, block own-listings,
 * require hours on an hourly listing, derive the service price and the fee —
 * lifted out so a *preview* and the *charge* run the same code rather than two
 * implementations that agree until they don't (mobile D-E9-1, P-E9-1, inherited
 * from D-E8A-1 rather than decided again).
 *
 * That mattered enough to be worth the extraction: the web booking flow
 * currently does this arithmetic a second time in the browser
 * (`service-booking-flow.tsx`), and a mobile binary that cannot be hot-fixed
 * would have been a third. A quoted total that differs from the charged total is
 * the most damaging bug this flow has.
 *
 * **Blockers are returned, not thrown.** A preview needs to render *why* a
 * booking is unavailable — the own-listing case is an explanation rather than a
 * disabled button — so the caller decides whether a blocker is fatal.
 * `createBooking` maps the first one back to the error type it has always
 * thrown; the preview route ships the list.
 *
 * ## What this deliberately does NOT check
 *
 * **The requester's payment method.** `createBooking` still calls
 * `getStripeCustomerContext` itself, and that stays there: it is up to two live
 * Stripe calls, it is a fact about the *account* rather than an input to the
 * quote, and a preview is re-fetched every time someone edits the hours. The
 * client pre-checks it against its own saved-cards list — UX only — and the
 * server remains the authority at submit.
 */

export type ServiceQuoteBlockerCode =
  | "OWN_LISTING"
  | "HOURS_REQUIRED"
  | "PROPOSED_DATE_IN_PAST";

export interface ServiceQuoteBlocker {
  /** Stable, for the client to branch on — never the message (mobile rule #8). */
  code: ServiceQuoteBlockerCode;
  /** Rendered verbatim. The existing copy, preserved to the character. */
  message: string;
}

export interface ServiceBookingQuoteInput {
  listingId: string;
  /** `YYYY-MM-DD`, wall clock — the day the work happens. */
  proposedDate: string;
  hours?: number | null;
}

export interface ServiceBookingQuote {
  listingId: string;
  listingTitle: string;
  providerId: string;
  /** Carried so `createBooking` needs no second read of the listing. */
  communityId: string;
  pricingType: "fixed" | "hourly";
  /** The listing's rate: per hour when hourly, else the flat price. */
  rate: number;
  hours: number | null;
  /** Rate × hours for an hourly listing, or the flat price. */
  servicePrice: number;
  serviceFee: number;
  totalAmount: number;
  canBook: boolean;
  blockers: ServiceQuoteBlocker[];
  /** Nothing is charged until the provider accepts (Req 11.1.2). */
  chargedOnAcceptance: true;
}

/** Today in the market zone, as `YYYY-MM-DD`. */
function marketToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Price and validate a prospective service booking.
 *
 * @throws NotFoundError when the listing does not exist **or is not active** —
 *   both, because that is exactly what `createBooking` has always thrown, and
 *   an inactive listing is not bookable in a way a client can explain away.
 */
export async function quoteServiceBooking(
  input: ServiceBookingQuoteInput,
  requesterId: string,
  options: { now?: Date } = {},
): Promise<ServiceBookingQuote> {
  const listing = await serviceListingDAL.getById(input.listingId);
  if (!listing || listing.status !== "active") {
    throw new NotFoundError("Service listing", input.listingId);
  }

  const blockers: ServiceQuoteBlocker[] = [];

  // Message preserved verbatim from `createBooking`.
  if (listing.providerId === requesterId) {
    blockers.push({
      code: "OWN_LISTING",
      message: "cannot_book_own_listing",
    });
  }

  const hourly = listing.pricingType === "hourly";
  const hours = hourly ? (input.hours ?? null) : null;

  if (hourly && (hours == null || hours <= 0)) {
    blockers.push({
      code: "HOURS_REQUIRED",
      message: "Hours are required for hourly listings",
    });
  }

  // ⚠️ **A guard that did not exist before** (mobile P-E9-1b). `createBooking`
  // validated the listing, the own-listing rule and the hours, then inserted —
  // with **no check on the date at all**, so a service could be booked for last
  // year and would sit in the schedule as a pending request against a day that
  // has gone. The rental side gained the same guard with P-E8A-2b.
  //
  // Day granularity, matching `isPastDay` on the rental side: a booking made at
  // 3pm for 9am *today* is late, not invalid, and the provider is the one who
  // decides whether to accept it. Evaluated in the market zone, because the
  // stored value is a zoneless wall clock (F4).
  if (input.proposedDate < marketToday(options.now ?? new Date())) {
    blockers.push({
      code: "PROPOSED_DATE_IN_PAST",
      message: "Proposed date cannot be in the past",
    });
  }

  const rate = Number(listing.price);
  // The same two lines `createBooking` has always run — moved, not rewritten.
  const servicePrice = hourly
    ? Math.round(rate * (hours ?? 0) * 100) / 100
    : Math.round(rate * 100) / 100;
  const serviceFee = calculateServiceFee(servicePrice);
  const totalAmount = Math.round((servicePrice + serviceFee) * 100) / 100;

  return {
    listingId: listing.id,
    listingTitle: listing.title,
    providerId: listing.providerId,
    communityId: listing.communityId,
    pricingType: hourly ? "hourly" : "fixed",
    rate,
    hours,
    servicePrice,
    serviceFee,
    totalAmount,
    canBook: blockers.length === 0,
    blockers,
    // Stated in the payload so no client has to remember which way round this
    // lifecycle works: the client is charged when the provider accepts, never
    // at submit (Req 11.1.2).
    chargedOnAcceptance: true,
  };
}

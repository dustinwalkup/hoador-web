import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import {
  serviceBookingDAL,
  serviceAgreementDocumentDAL,
  servicePaymentLifecycleDAL,
  legalDocumentDAL,
} from "@/dal";
import type { ServiceBookingWithDetails } from "@/dal/service-booking.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import { toWallClock } from "@/features/schedule/lib/build-schedule";

/** Which side of the booking the viewer is on — decided here, never by the client. */
export type ServiceBookingViewerRole = "requester" | "provider";

/** Decimal string → integer cents, and back. Keeps the split off floats. */
function toCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Instants are serialized **explicitly**, not left to `Response.json`.
 *
 * `Response.json` calls `toISOString()` on a `Date` silently, which is correct
 * for an instant and catastrophic for a booked day — the difference that made
 * R-8.7 and P-E8A-4 invisible in UTC and wrong everywhere else. Writing the
 * conversion out means the wire form of every field on this route is a decision
 * someone made, and it lets `ServiceBookingDetailResponse` describe what the
 * client actually receives rather than what the handler happens to hold.
 */
function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Exactly what this route puts on the wire. See `toIso` for why it can say so. */
export interface ServiceBookingDetailResponse {
  id: string;
  listingId: string;
  requesterId: string;
  providerId: string;
  /** `YYYY-MM-DD`, wall clock — a day, not an instant. */
  proposedDate: string;
  /** `HH:MM`, wall clock. */
  proposedTime: string;
  /** `numeric(4,2)` as a decimal string; `null` for fixed-price listings. */
  hours: string | null;
  notes: string | null;
  servicePrice: string;
  serviceFee: string;
  totalAmount: string;
  refundAmount: string | null;
  status: string;
  paymentStatus: string | null;
  declineReason: string | null;
  cancellationReason: string | null;
  cancelledByRole: ServiceBookingViewerRole | "admin" | null;
  createdAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  listing: {
    id: string;
    title: string;
    pricingType: string;
    price: string;
    photos: string[];
  };
  requester: ServiceBookingParty;
  provider: ServiceBookingParty;
  conversationId: string | null;
  viewerRole: ServiceBookingViewerRole;
  earnings: ServiceBookingEarnings | null;
  agreement: { pdfUrl: string; templateVersion: string } | null;
}

/** Names and avatars only — never an email (see the handler's docblock). */
export interface ServiceBookingParty {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface ServiceBookingEarnings {
  servicePrice: string;
  platformFee: string;
  providerPayout: string;
  platformFeePercent: number;
}

/**
 * `proposedDate` is a pg `date` and reaches TS as `YYYY-MM-DD` — a **wall clock
 * day with no zone**, which is why the schedule DAL refuses to coerce it to a
 * `Date` at all. Pass it through untouched.
 *
 * The `Date` branch exists because two call sites in this repo hedge about the
 * type (`page.tsx`'s `serializeBooking`, `cancelBooking`'s `typeof` check), and
 * a driver or mode change that made them right must not silently turn a booked
 * day into an instant: `Response.json` would emit UTC midnight and every client
 * behind UTC would render the PREVIOUS day. That is R-8.7 / P-E8A-4, found
 * twice already on this codebase. `toWallClock` reads local components, which
 * is the same remedy applied in both.
 */
function serializeProposedDate(value: string | Date): string {
  return value instanceof Date ? toWallClock(value, { dateOnly: true }) : value;
}

/**
 * The provider's itemized earnings preview (mobile Req 11.2), shown before an
 * acceptance that charges the client immediately (Req 11.2.2).
 *
 * Two sources, and which one is used depends on whether the money has moved:
 *
 *  - **Already charged** → the payout **stored** on `service_payment_lifecycle`
 *    at charge time. That is what the Connect transfer will actually pay out.
 *    Re-deriving it on read would quote *today's* platform rate for a booking
 *    charged under yesterday's (the P-E8A-5 argument, one domain over).
 *  - **Not yet charged** → the rule quoted forward, using the same expression
 *    `acceptBooking` will apply. This is a *quote*, not a re-derivation: there
 *    is no stored value to disagree with yet, and a provider who is about to
 *    charge somebody has to be told what they earn.
 *
 * Returns `null` — never `$0.00` — for a non-provider, and for an already
 * charged booking whose lifecycle row is missing (a legacy row). The client
 * then says the payout will be confirmed rather than promising a number.
 */
function buildProviderEarnings(
  viewerRole: ServiceBookingViewerRole,
  booking: { servicePrice: string; status: string },
  storedPayout: string | null,
): ServiceBookingEarnings | null {
  if (viewerRole !== "provider") return null;

  const servicePriceCents = toCents(booking.servicePrice);
  if (servicePriceCents === null) return null;

  const storedCents = toCents(storedPayout);
  // Charged states. `cancelled` is deliberately absent: a booking cancelled
  // while pending was never charged, and one cancelled after acceptance has a
  // lifecycle row, so it takes the stored branch above regardless.
  const charged =
    booking.status === "accepted" || booking.status === "completed";

  const payoutCents =
    storedCents ??
    (charged
      ? null
      : Math.round(servicePriceCents * (1 - PLATFORM_FEE_PERCENTAGE)));
  if (payoutCents === null) return null;

  const platformFeeCents = servicePriceCents - payoutCents;
  if (platformFeeCents < 0) return null;

  return {
    servicePrice: fromCents(servicePriceCents),
    platformFee: fromCents(platformFeeCents),
    providerPayout: fromCents(payoutCents),
    platformFeePercent: Math.round(PLATFORM_FEE_PERCENTAGE * 100),
  };
}

/**
 * The signed agreement for a booking, or the generic fallback, or `null`.
 *
 * Two tiers, mirroring the rental side's intent: the generated per-booking PDF
 * if one exists, otherwise the current published `per_service_agreement`
 * document (Req 22.1.3). Any failure resolves to `null` — the agreement is
 * supplementary to the booking detail and must not fail the response.
 *
 * The generated PDF is produced *on acceptance*, so a pending booking
 * legitimately resolves to the generic document.
 */
async function resolveBookingAgreement(
  bookingId: string,
): Promise<{ pdfUrl: string; templateVersion: string } | null> {
  const { data: generated } = await tryCatch(
    serviceAgreementDocumentDAL.getByServiceBookingId(bookingId),
  );
  if (generated) {
    return {
      pdfUrl: generated.pdfUrl,
      templateVersion: generated.templateVersion,
    };
  }

  const { data: fallback } = await tryCatch(
    legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT,
    ),
  );
  if (fallback) {
    return { pdfUrl: fallback.url, templateVersion: fallback.version };
  }

  return null;
}

/**
 * Who cancelled, as a **role** rather than a raw id.
 *
 * Req 11.2.6 makes the answer change the money: a provider cancellation refunds
 * the client in full, a client cancellation inside 24 hours does not. The
 * client must not work that out by comparing `cancelledBy` against two ids it
 * also has to trust — the same reasoning that makes `viewerRole` server-decided.
 */
function cancelledByRole(
  booking: Pick<
    ServiceBookingWithDetails,
    "cancelledBy" | "requesterId" | "providerId"
  >,
): ServiceBookingViewerRole | "admin" | null {
  if (!booking.cancelledBy) return null;
  if (booking.cancelledBy === booking.requesterId) return "requester";
  if (booking.cancelledBy === booking.providerId) return "provider";
  return "admin";
}

/**
 * GET /api/services/bookings/[id]
 * Booking detail when viewer is requester or provider.
 *
 * **The response is composed explicitly, not spread** (mobile P-E9-3). The
 * previous implementation returned `{ ...booking }` — the whole row joined to
 * the whole listing and both user rows — which shipped
 * `stripePaymentIntentId`, `stripeChargeId`, `stripeRefundId`,
 * `selectedPaymentMethodId` **and both parties' email addresses** to the
 * counterparty on every poll. None of it was read by any consumer; all of it
 * crossed the wire. A payment instrument identifier and a neighbour's email are
 * not detail-screen material, and an allow-list is the only shape of this
 * function that stays safe when a column is added to the table.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const { data: booking, error } = await tryCatch(
      serviceBookingDAL.getById(id),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Both parties are checked above, so this is exhaustive — unlike the rental
    // route, there is no admin branch because this endpoint has never admitted
    // one.
    const viewerRole: ServiceBookingViewerRole =
      booking.requesterId === userId ? "requester" : "provider";

    // Serialize the signed agreement (Req 22.1.2). Access is already party-only
    // above. Unlike rentals, the service side has no built-in fallback DAL, so
    // it is composed here: prefer the generated PDF, else degrade to the generic
    // `per_service_agreement` document (Req 22.1.3, D-E2-7 — NOT the rental
    // agreement the index suggested; that would be the wrong document for a
    // booking). A lookup failure degrades to `null`, never failing the detail.
    const agreement = await resolveBookingAgreement(id);

    // Only the provider has earnings, so only the provider costs a lookup. A
    // failure degrades to the forward quote (or `null` on a charged booking)
    // rather than failing a screen whose main job is the booking itself.
    let storedPayout: string | null = null;
    if (viewerRole === "provider") {
      const { data: lifecycle } = await tryCatch(
        servicePaymentLifecycleDAL.getByBookingId(id),
      );
      storedPayout = lifecycle?.providerPayout ?? null;
    }

    return NextResponse.json<ServiceBookingDetailResponse>({
      id: booking.id,
      listingId: booking.listingId,
      requesterId: booking.requesterId,
      providerId: booking.providerId,

      // Wall clock, both of them: a pg `date` and a bare `varchar`, neither
      // carrying a zone. They are the day and time the work happens, not
      // instants, and must never round-trip through `Date` on the client.
      proposedDate: serializeProposedDate(booking.proposedDate),
      proposedTime: booking.proposedTime,
      /** `numeric(4,2)` — a decimal STRING, and null for fixed-price listings. */
      hours: booking.hours,
      notes: booking.notes,

      servicePrice: booking.servicePrice,
      serviceFee: booking.serviceFee,
      totalAmount: booking.totalAmount,
      refundAmount: booking.refundAmount,

      status: booking.status,
      paymentStatus: booking.paymentStatus,
      declineReason: booking.declineReason,
      cancellationReason: booking.cancellationReason,
      cancelledByRole: cancelledByRole(booking),

      // Genuine instants, every one of them — the lifecycle moments the
      // Timeline (Req 5.7.6) is built from. `acceptedAt`/`declinedAt` are new
      // (P-E9-4) and are `null` on rows backfilled from a state that could not
      // be dated honestly; a stage that happened without a timestamp is the
      // Timeline's problem to render, not a reason to invent one here.
      createdAt: booking.createdAt.toISOString(),
      acceptedAt: toIso(booking.acceptedAt),
      declinedAt: toIso(booking.declinedAt),
      completedAt: toIso(booking.completedAt),
      cancelledAt: toIso(booking.cancelledAt),
      expiresAt: booking.expiresAt.toISOString(),

      listing: {
        id: booking.listing.id,
        title: booking.listing.title,
        pricingType: booking.listing.pricingType,
        price: booking.listing.price,
        photos: booking.listing.photos ?? [],
      },
      // Names and avatars only. In-app messaging is the contact channel
      // (`conversationId` below); an email address is not detail-screen
      // material for either side.
      requester: {
        id: booking.requester.id,
        firstName: booking.requester.firstName,
        lastName: booking.requester.lastName,
        profileImageUrl: booking.requester.profileImageUrl,
      },
      provider: {
        id: booking.provider.id,
        firstName: booking.provider.firstName,
        lastName: booking.provider.lastName,
        profileImageUrl: booking.provider.profileImageUrl,
      },
      conversationId: booking.conversationId,

      viewerRole,
      earnings: buildProviderEarnings(viewerRole, booking, storedPayout),
      agreement,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/bookings/[id]",
);

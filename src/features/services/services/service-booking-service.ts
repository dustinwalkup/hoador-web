import {
  auditLogDAL,
  disputeDAL,
  legalDocumentDAL,
  paymentDAL,
  serviceBookingDAL,
  serviceListingDAL,
  servicePaymentLifecycleDAL,
  userDAL,
} from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceBookingPaymentFailedError,
  ValidationError,
} from "@/dal/errors";
import {
  calculateServiceFee,
  PLATFORM_FEE_PERCENTAGE,
  PENDING_BOOKING_EXPIRY_WINDOW_HOURS,
  STRIPE_MINIMUM_CHARGE_USD,
} from "@/constants/payments";
import {
  assessServiceCancellation,
  hoursUntilService,
  serviceInstant,
  serviceRefundBreakdown,
  serviceRefundTierFor,
} from "@/features/services/lib/booking-cancellation";
import { assertConnectReady } from "@/features/payments/lib/assert-connect-ready";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import {
  sendBookingAcceptedNotification,
  sendBookingDeclinedNotification,
  sendJobCompletedNotification,
  sendNewBookingRequestNotification,
} from "@/features/services/notifications/service-notifications";
import {
  chargeServicePayment,
  createServiceTransfer,
} from "@/services/stripe/service-payments";
import { getStripeCustomerContext } from "@/services/stripe/payment-method";
import { getPaymentErrorMessage } from "@/services/stripe/rental-payments";
import { processRefund } from "@/services/stripe/refund";

import { after } from "next/server";
import { closeNeedsFulfilledByBooking } from "@/features/neighborhood-needs/services/neighborhood-needs-service";
import type { AuditContext, CreateBookingInput } from "../types";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
}

/**
 * Application service for HOA service bookings (request, accept, cancel, etc.).
 */
export class ServiceBookingService {
  /**
   * Requester submits a booking for an active listing.
   */
  static async createBooking(
    formData: CreateBookingInput,
    requesterId: string,
    context: AuditContext,
  ) {
    const listingDetail = await serviceListingDAL.getById(formData.listingId);
    if (!listingDetail || listingDetail.status !== "active") {
      throw new NotFoundError("Service listing", formData.listingId);
    }

    if (listingDetail.providerId === requesterId) {
      throw new ForbiddenError("cannot_book_own_listing");
    }

    const pm = await getStripeCustomerContext(requesterId);
    if (!pm) {
      throw new ValidationError("payment_method_required", "paymentMethod");
    }

    const priceNum = Number(listingDetail.price);
    let servicePrice =
      listingDetail.pricingType === "hourly"
        ? priceNum * (formData.hours ?? 0)
        : priceNum;

    if (listingDetail.pricingType === "hourly") {
      if (formData.hours == null || formData.hours <= 0) {
        throw new ValidationError(
          "Hours are required for hourly listings",
          "hours",
        );
      }
    }

    servicePrice = Math.round(servicePrice * 100) / 100;
    const serviceFee = calculateServiceFee(servicePrice);
    const totalAmount = Math.round((servicePrice + serviceFee) * 100) / 100;

    const booking = await serviceBookingDAL.create({
      listingId: formData.listingId,
      requesterId,
      providerId: listingDetail.providerId,
      communityId: listingDetail.communityId,
      proposedDate: formData.proposedDate,
      proposedTime: formData.proposedTime,
      hours:
        listingDetail.pricingType === "hourly" ? String(formData.hours) : null,
      notes: formData.notes ?? null,
      declineReason: null,
      servicePrice: String(servicePrice),
      serviceFee: String(serviceFee),
      totalAmount: String(totalAmount),
      status: "pending",
      stripePaymentIntentId: null,
      stripeChargeId: null,
      paymentStatus: null,
      refundAmount: null,
      stripeRefundId: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      completedAt: null,
      selectedPaymentMethodId: formData.paymentMethodId ?? null,
      expiresAt: new Date(
        Date.now() + PENDING_BOOKING_EXPIRY_WINDOW_HOURS * 60 * 60 * 1000,
      ),
    });

    await auditLogDAL.create({
      entityType: "service_booking",
      entityId: booking.id,
      action: "service_booking.created",
      userId: requesterId,
      metadata: {
        listingId: formData.listingId,
        providerId: listingDetail.providerId,
      },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    await sendNewBookingRequestNotification(listingDetail.providerId, booking);

    if (
      formData.serviceAgreementAccepted ||
      formData.cancellationRefundAcknowledged ||
      formData.safetyLiabilityAccepted ||
      formData.paymentPayoutAccepted ||
      formData.platformTermsAccepted
    ) {
      try {
        const documentVersions = await legalDocumentDAL.getAllCurrentVersions();
        const acceptancePromises = [];

        if (
          formData.serviceAgreementAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT]
        ) {
          const doc =
            documentVersions[LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              requesterId,
              LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT,
              doc.version,
              context.ipAddress ?? null,
              context.userAgent ?? null,
              "service_booking_checkout",
              undefined,
              formData.listingId,
            ),
          );
        }
        if (
          formData.cancellationRefundAcknowledged &&
          documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              requesterId,
              LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND,
              doc.version,
              context.ipAddress ?? null,
              context.userAgent ?? null,
              "service_booking_checkout",
              undefined,
              formData.listingId,
            ),
          );
        }
        if (
          formData.safetyLiabilityAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
        ) {
          const doc =
            documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              requesterId,
              LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
              doc.version,
              context.ipAddress ?? null,
              context.userAgent ?? null,
              "service_booking_checkout",
              undefined,
              formData.listingId,
            ),
          );
        }
        if (
          formData.paymentPayoutAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              requesterId,
              LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS,
              doc.version,
              context.ipAddress ?? null,
              context.userAgent ?? null,
              "service_booking_checkout",
              undefined,
              formData.listingId,
            ),
          );
        }
        if (
          formData.platformTermsAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.TOS]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              requesterId,
              LEGAL_DOCUMENT_IDS.TOS,
              doc.version,
              context.ipAddress ?? null,
              context.userAgent ?? null,
              "service_booking_checkout",
              undefined,
              formData.listingId,
            ),
          );
        }
        await Promise.allSettled(acceptancePromises);
      } catch (error) {
        captureNonCriticalError(error, {
          route: "ServiceBookingService.createBooking",
          action: "record_legal_acceptances",
        });
      }
    }

    return booking;
  }

  /**
   * Provider accepts: charge requester off-session, persist payment + booking.
   */
  static async acceptBooking(
    bookingId: string,
    providerId: string,
    context: AuditContext,
  ) {
    const detail = await serviceBookingDAL.getById(bookingId);
    if (!detail) {
      throw new NotFoundError("Service booking", bookingId);
    }
    if (detail.providerId !== providerId) {
      throw new ForbiddenError("You are not the provider for this booking");
    }
    if (detail.status !== "pending" && detail.status !== "payment_failed") {
      throw new ValidationError("Booking is not pending", "status");
    }

    // Stripe Connect readiness: fast-path on cached flags, then authoritative
    // live retrieve. Throws PaymentSetupRequiredError on any failure; the
    // route handler translates that to a 403 PAYMENT_SETUP_REQUIRED response.
    // Booking stays in `pending` since we throw before transitioning state.
    await assertConnectReady(providerId, {
      bookingType: "service",
      bookingId,
    });

    const stripeCtx = await getStripeCustomerContext(detail.requesterId);
    if (!stripeCtx) {
      throw new ValidationError("payment_method_required", "paymentMethod");
    }

    let paymentMethodId: string;

    if (detail.status === "payment_failed") {
      // On retry, always use the requester's current Stripe default — not the previously failed PM.
      paymentMethodId = stripeCtx.paymentMethodId;

      // Guard: if the default is the card that just failed, reject early. The
      // failure branch below writes that card here, so this compares against
      // what was actually attempted rather than what was once chosen (F12).
      if (
        detail.selectedPaymentMethodId != null &&
        detail.selectedPaymentMethodId === paymentMethodId
      ) {
        throw new ValidationError(
          "Payment method is unchanged. Please update your default payment method and ask the provider to retry.",
          "paymentMethod",
        );
      }
    } else {
      // First acceptance attempt: prefer the PM the requester chose at booking creation.
      paymentMethodId =
        detail.selectedPaymentMethodId ?? stripeCtx.paymentMethodId;
    }

    // Backstop: never hand Stripe an amount it will reject as invalid. The
    // listing price floor prevents this for new listings; this catches
    // legacy/below-floor listings before they hit Stripe with an opaque error.
    const chargeAmount = Number(detail.totalAmount);
    if (chargeAmount < STRIPE_MINIMUM_CHARGE_USD) {
      throw new ValidationError(
        `This booking total ($${chargeAmount.toFixed(2)}) is below the $${STRIPE_MINIMUM_CHARGE_USD.toFixed(2)} minimum required to process a payment. Please contact support.`,
        "amount",
      );
    }

    const chargeIdempotencyKey =
      detail.status === "payment_failed"
        ? `service-charge-${detail.id}-retry-${Date.now()}`
        : `service-charge-${detail.id}`;

    try {
      const { paymentIntent, chargeId } = await chargeServicePayment({
        customerId: stripeCtx.customerId,
        paymentMethodId,
        amount: Number(detail.totalAmount),
        metadata: {
          paymentType: "service_charge",
          bookingId: detail.id,
          serviceId: detail.listingId,
          providerId: detail.providerId,
          requesterId: detail.requesterId,
        },
        idempotencyKey: chargeIdempotencyKey,
      });

      const updated = await serviceBookingDAL.update(bookingId, {
        status: "accepted",
        // The moment the client was charged (P-E9-4). Written INSIDE the
        // success branch, after the charge returned, so it dates the
        // transition rather than the attempt — a `payment_failed` booking
        // that is later retried and succeeds gets the successful accept's
        // time, which is the one a Timeline should show.
        acceptedAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: chargeId,
        paymentStatus: paymentIntent.status,
      });

      await paymentDAL.createPayment({
        serviceBookingId: detail.id,
        payerId: detail.requesterId,
        payeeId: detail.providerId,
        amount: String(detail.totalAmount),
        platformFee: String(detail.serviceFee),
        paymentMethodId,
        stripePaymentIntentId: paymentIntent.id,
        status: "succeeded",
        paidAt: new Date(),
        paymentType: "service_charge",
      });

      const providerPayout =
        Math.round(
          Number(detail.servicePrice) * (1 - PLATFORM_FEE_PERCENTAGE) * 100,
        ) / 100;

      await servicePaymentLifecycleDAL.create({
        bookingId: detail.id,
        chargeId,
        providerPayout: String(providerPayout),
        ownerTransferStatus: "pending",
        payoutStatus: "pending",
      });

      await auditLogDAL.create({
        entityType: "service_booking",
        entityId: bookingId,
        action: "service_booking.accepted",
        userId: providerId,
        metadata: { paymentIntentId: paymentIntent.id },
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      });

      await sendBookingAcceptedNotification(detail.requesterId, updated);

      const needsListingId = detail.listingId;
      const needsRequesterId = detail.requesterId;
      after(async () => {
        await closeNeedsFulfilledByBooking({
          listingType: "service",
          listingId: needsListingId,
          bookerUserId: needsRequesterId,
        }).catch((err) =>
          captureNonCriticalError(err, {
            route: "ServiceBookingService.acceptBooking",
            action: "closeNeedsFulfilledByBooking",
          }),
        );
      });

      const internalSecret = process.env.INTERNAL_API_SECRET;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (internalSecret && baseUrl) {
        const pdfUrl = `${baseUrl}/api/internal/generate-service-agreement`;
        after(async () => {
          try {
            console.log("[pdf-gen] triggering service agreement", {
              url: pdfUrl,
              serviceBookingId: bookingId,
            });
            const res = await fetch(pdfUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${internalSecret}`,
              },
              body: JSON.stringify({ serviceBookingId: bookingId }),
              signal: AbortSignal.timeout(30_000),
            });
            const body = await res.text().catch(() => "unreadable");
            console.log("[pdf-gen] service agreement response", {
              status: res.status,
              body: body.slice(0, 500),
            });
          } catch (err) {
            console.error("[pdf-gen] service agreement fetch failed", {
              url: pdfUrl,
              error: err instanceof Error ? err.message : String(err),
            });
            captureNonCriticalError(err, {
              route: "ServiceBookingService.acceptBooking",
              action: "trigger_service_agreement_pdf",
            });
          }
        });
      }

      return updated;
    } catch (error) {
      await serviceBookingDAL.update(bookingId, {
        status: "payment_failed",
        paymentStatus: "failed",
        // Record the card that ACTUALLY failed, so the retry guard above has
        // something true to compare against (mobile F12, fixed 2026-09-01).
        //
        // The guard's intent has always been "do not re-charge a card we know
        // is dead", but it compared the client's current default against the
        // card chosen at *booking* time — a field nothing ever updated. It
        // therefore worked on the first retry and stopped working after that:
        // once a fallback to the default had failed, the field still named the
        // original choice, so the same dead default could be re-charged
        // indefinitely. A booking made without an explicit card
        // (`selectedPaymentMethodId: null`) skipped the guard entirely and
        // could be retried against the same failing default with no limit.
        //
        // Overwriting is lossless: after a failure the booking-time choice has
        // no reader left — the retry path deliberately uses the current
        // default (see above), no route serializes this column, and P-E9-3
        // removed it from the wire.
        selectedPaymentMethodId: paymentMethodId,
      });

      const message = getPaymentErrorMessage(error);

      await sendNotification({
        userId: detail.requesterId,
        type: "payment_failed",
        title: "Service payment failed",
        message: `We could not charge your card for this booking. ${message}`,
        data: { bookingId: detail.id, listingId: detail.listingId },
        linkUrl: `${appBaseUrl()}/dashboard/services/bookings/${detail.id}`,
      });

      await sendNotification({
        userId: detail.providerId,
        type: "system",
        title: "Payment failed for booking",
        message:
          "The requester's payment could not be processed. They may need to update their payment method.",
        data: { bookingId: detail.id },
        linkUrl: `${appBaseUrl()}/dashboard/services/bookings/${detail.id}`,
      });

      captureNonCriticalError(error, {
        route: "/api/services/bookings",
        action: "accept_booking_charge_failed",
      });

      await auditLogDAL.create({
        entityType: "service_booking",
        entityId: bookingId,
        action: "service_booking.payment_failed",
        userId: providerId,
        metadata: { error: message },
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      });

      throw new ServiceBookingPaymentFailedError(
        "We could not process the requester's payment for this booking.",
      );
    }
  }

  /**
   * Provider declines a pending booking (reason required).
   */
  static async declineBooking(
    bookingId: string,
    providerId: string,
    reason: string,
    context: AuditContext,
  ) {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new ValidationError("decline_reason_required", "reason");
    }

    const detail = await serviceBookingDAL.getById(bookingId);
    if (!detail) {
      throw new NotFoundError("Service booking", bookingId);
    }
    if (detail.providerId !== providerId) {
      throw new ForbiddenError("You are not the provider for this booking");
    }
    if (detail.status !== "pending" && detail.status !== "payment_failed") {
      throw new ValidationError("Booking is not pending", "status");
    }

    const updated = await serviceBookingDAL.update(bookingId, {
      status: "declined",
      declinedAt: new Date(),
      declineReason: trimmed,
    });

    await auditLogDAL.create({
      entityType: "service_booking",
      entityId: bookingId,
      action: "service_booking.declined",
      userId: providerId,
      metadata: {},
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    await sendBookingDeclinedNotification(detail.requesterId, updated, trimmed);

    return updated;
  }

  /**
   * Provider marks job complete (starts payout window).
   */
  static async completeBooking(
    bookingId: string,
    providerId: string,
    context: AuditContext,
  ) {
    const detail = await serviceBookingDAL.getById(bookingId);
    if (!detail) {
      throw new NotFoundError("Service booking", bookingId);
    }
    if (detail.providerId !== providerId) {
      throw new ForbiddenError("You are not the provider for this booking");
    }
    if (detail.status !== "accepted") {
      throw new ValidationError(
        "Booking must be accepted to complete",
        "status",
      );
    }

    const now = new Date();
    const updated = await serviceBookingDAL.update(bookingId, {
      status: "completed",
      completedAt: now,
    });

    await servicePaymentLifecycleDAL.updatePayoutStatus(bookingId, "pending");

    await auditLogDAL.create({
      entityType: "service_booking",
      entityId: bookingId,
      action: "service_booking.completed",
      userId: providerId,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    await sendJobCompletedNotification(detail.requesterId, updated);

    return updated;
  }

  /**
   * Requester or provider cancels; refunds when a charge exists.
   */
  static async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string,
    context?: AuditContext,
  ) {
    const detail = await serviceBookingDAL.getById(bookingId);
    if (!detail) {
      throw new NotFoundError("Service booking", bookingId);
    }

    const activeDispute =
      await disputeDAL.getActiveByServiceBookingId(bookingId);

    // The SAME assessment the preview route runs (mobile D-E9-3, P-E9-2). The
    // quote a client confirmed against and the refusal they might get instead
    // are now one code path by construction, rather than two implementations
    // kept in step by a test.
    const eligibility = assessServiceCancellation(
      detail,
      userId,
      Boolean(activeDispute),
    );
    if (!eligibility.canCancel) {
      if (eligibility.code === "NOT_A_PARTY") {
        throw new ForbiddenError(eligibility.message);
      }
      if (eligibility.code === "ACTIVE_DISPUTE") {
        throw new ConflictError(eligibility.message);
      }
      throw new ValidationError(eligibility.message, "status");
    }

    const isRequester = eligibility.cancelledBy === "requester";

    // ⚠️ The job time is now read in the MARKET zone, not the server's. Until
    // 2026-09-01 this was `new Date("YYYY-MM-DDTHH:MM:00")`, parsed as
    // server-local — UTC on Vercel — so a 6pm job in a UTC-5 market was treated
    // as 1pm and the 24-hour boundary moved five hours earlier, pushing clients
    // into the 50% tier while they still had a day to spare (F4). Correct in
    // UTC, so no test could ever have caught it.
    const serviceAt = serviceInstant(detail);
    const tier = serviceRefundTierFor(
      eligibility,
      hoursUntilService(serviceAt),
      Boolean(detail.stripeChargeId),
    );
    const breakdown = serviceRefundBreakdown(tier, detail);
    const refundAmountCents = breakdown.refundCents;
    let stripeRefundId: string | null = null;
    let refundAmountStr: string | null = null;

    const existingLifecycle =
      await servicePaymentLifecycleDAL.getByBookingId(bookingId);
    if (existingLifecycle) {
      await servicePaymentLifecycleDAL.markCancelled(bookingId);
    }

    if (refundAmountCents > 0 && detail.stripeChargeId) {
      const refundResult = await processRefund({
        serviceBookingId: detail.id,
        chargeId: detail.stripeChargeId,
        refundAmountCents,
        reason: reason?.trim() || "service_booking_cancelled",
      });

      if (!refundResult.success) {
        captureNonCriticalError(new Error(refundResult.error), {
          route: "/api/services/bookings",
          action: "cancel_booking_refund_failed",
        });
        await sendOpsAlert({
          event: "service_booking_refund_failed",
          serviceBookingId: detail.id,
          message: refundResult.error,
          sendEmailAlert: true,
        });
      } else {
        stripeRefundId = refundResult.refundId;
        refundAmountStr = (refundAmountCents / 100).toFixed(2);
      }
    }

    // The provider's retained share on a late client cancellation (50% kept,
    // less the platform's 20% = 30% of the service price). The figure comes
    // from the same breakdown the preview quotes, so what a provider is told
    // they will receive is what the transfer actually moves.
    if (breakdown.providerTransferCents > 0 && detail.stripeChargeId) {
      const providerUser = await userDAL.getUserById(detail.providerId);
      const providerConnectedAccountId =
        providerUser?.stripeConnectedAccountId ?? null;
      const providerPayoutAmount = breakdown.providerTransferCents / 100;

      if (providerConnectedAccountId && providerPayoutAmount > 0) {
        const transferResult = await createServiceTransfer({
          bookingId,
          idempotencyKey: `service-cancel-transfer-${bookingId}`,
          chargeId: detail.stripeChargeId,
          providerConnectedAccountId,
          providerPayoutAmount,
        });

        if (transferResult.success) {
          await servicePaymentLifecycleDAL.updateOwnerTransferStatus(
            bookingId,
            "completed",
            {
              stripeTransferId: transferResult.transferId,
              ownerTransferredAt: new Date(),
              transferAmount: providerPayoutAmount,
            },
          );
        } else {
          captureNonCriticalError(new Error(transferResult.error), {
            route: "/api/services/bookings",
            action: "cancel_booking_provider_transfer_failed",
          });
          await sendOpsAlert({
            event: "service_booking_cancel_transfer_failed",
            serviceBookingId: detail.id,
            message: transferResult.error,
            sendEmailAlert: true,
          });
        }
      }
    }

    const updated = await serviceBookingDAL.update(bookingId, {
      status: "cancelled",
      refundAmount: refundAmountStr,
      stripeRefundId,
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: reason?.trim() ?? null,
    });

    if (context) {
      await auditLogDAL.create({
        entityType: "service_booking",
        entityId: bookingId,
        action: "service_booking.cancelled",
        userId,
        metadata: {
          refundCents: refundAmountCents,
          isRequester,
        },
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      });
    }

    const refundLabel = refundAmountStr
      ? `$${refundAmountStr}`
      : refundAmountCents > 0
        ? "Refund pending — see support if this does not settle"
        : "$0.00";

    const msg = `This booking was cancelled. Refund: ${refundLabel}.`;

    await sendNotification({
      userId: detail.requesterId,
      type: "system",
      title: "Booking cancelled",
      message: msg,
      data: { bookingId: detail.id, refundAmount: refundLabel },
      linkUrl: `${appBaseUrl()}/dashboard/services/bookings/${detail.id}`,
    });

    await sendNotification({
      userId: detail.providerId,
      type: "system",
      title: "Booking cancelled",
      message: msg,
      data: { bookingId: detail.id, refundAmount: refundLabel },
      linkUrl: `${appBaseUrl()}/dashboard/services/bookings/${detail.id}`,
    });

    return updated;
  }
}

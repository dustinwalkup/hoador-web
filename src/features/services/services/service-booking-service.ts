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
} from "@/constants/payments";
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

import type { AuditContext, CreateBookingInput } from "../types";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
}

/**
 * Parses proposed date + time into a local Date for refund window checks.
 */
function parseProposedDateTime(
  proposedDate: string,
  proposedTime: string,
): Date {
  const safeTime =
    proposedTime.length >= 5 ? proposedTime.slice(0, 5) : proposedTime;
  const iso = `${proposedDate}T${safeTime}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

async function assertProviderConnectForCharge(
  providerId: string,
): Promise<boolean> {
  const u = await userDAL.getUserById(providerId);
  if (!u) return false;
  return Boolean(
    u.stripeConnectedAccountId &&
    u.connectChargesEnabled &&
    u.connectPayoutsEnabled,
  );
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

    const okConnect = await assertProviderConnectForCharge(providerId);
    if (!okConnect) {
      throw new ValidationError(
        "Provider Stripe Connect is not ready to accept payments",
        "stripe",
      );
    }

    const stripeCtx = await getStripeCustomerContext(detail.requesterId);
    if (!stripeCtx) {
      throw new ValidationError("payment_method_required", "paymentMethod");
    }

    const paymentMethodId =
      detail.selectedPaymentMethodId ?? stripeCtx.paymentMethodId;

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

      const internalSecret = process.env.INTERNAL_API_SECRET;
      const baseUrl =
        process.env.VERCEL_URL != null
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL;
      if (internalSecret && baseUrl) {
        fetch(`${baseUrl}/api/internal/generate-service-agreement`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({ serviceBookingId: bookingId }),
          signal: AbortSignal.timeout(5000),
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "ServiceBookingService.acceptBooking",
            action: "trigger_service_agreement_pdf",
          });
        });
      }

      return updated;
    } catch (error) {
      await serviceBookingDAL.update(bookingId, {
        status: "payment_failed",
        paymentStatus: "failed",
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

    if (detail.requesterId !== userId && detail.providerId !== userId) {
      throw new ForbiddenError("You cannot cancel this booking");
    }

    if (detail.status !== "pending" && detail.status !== "accepted") {
      throw new ValidationError("Booking cannot be cancelled", "status");
    }

    const activeDispute =
      await disputeDAL.getActiveByServiceBookingId(bookingId);
    if (activeDispute) {
      throw new ConflictError(
        "Cannot cancel a booking with an active dispute. Resolve the dispute first.",
      );
    }

    const isRequester = detail.requesterId === userId;
    const servicePriceNum = Number(detail.servicePrice);
    const totalAmountNum = Number(detail.totalAmount);
    let refundFraction = 0;

    if (detail.status === "accepted" && detail.stripeChargeId) {
      const proposed = parseProposedDateTime(
        typeof detail.proposedDate === "string"
          ? detail.proposedDate
          : String(detail.proposedDate),
        detail.proposedTime,
      );
      const hoursUntil = (proposed.getTime() - Date.now()) / (1000 * 60 * 60);

      if (isRequester) {
        refundFraction = hoursUntil > 24 ? 1 : 0.5;
      } else {
        refundFraction = 1;
      }
    }

    // Partial refunds: base on servicePrice — service fee is non-refundable
    // Full refunds (>24hr client cancel or provider cancel): refund totalAmount including service fee
    const refundBase = refundFraction < 1 ? servicePriceNum : totalAmountNum;
    const refundAmountCents = Math.round(refundBase * refundFraction * 100);
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

    // If requester cancels within 24hr, transfer provider's retained portion (50% - 20% fee = 30%)
    if (isRequester && refundFraction === 0.5 && detail.stripeChargeId) {
      const providerUser = await userDAL.getUserById(detail.providerId);
      const providerConnectedAccountId =
        providerUser?.stripeConnectedAccountId ?? null;
      const providerPayoutAmount =
        Math.round(
          servicePriceNum * (refundFraction - PLATFORM_FEE_PERCENTAGE) * 100,
        ) / 100;

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

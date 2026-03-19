import {
  rentalDAL,
  paymentDAL,
  paymentLifecycleDAL,
  userDAL,
  auditLogDAL,
} from "@/dal";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";
import type { CancellationReason } from "@/dal/types";
import { processRefund } from "@/services/stripe/refund";
import { createOwnerTransfer } from "@/services/stripe/payout";
import { releaseDepositHold } from "@/services/stripe/deposit-hold";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendRentalCancelledNotification } from "@/features/rentals/notifications/rental-cancelled";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { trackActivity } from "@/features/activity/lib/track-activity";
import {
  calculateRenterCancellationRefund,
  calculateOwnerCancellationRefund,
  calculateNoShowRefund,
} from "./refund-calculations";

export type { RefundCalculation } from "./refund-calculations";
export {
  calculateRenterCancellationRefund,
  calculateOwnerCancellationRefund,
  calculateNoShowRefund,
};

export type CancelApprovedRentalResult =
  | { success: true; refundAmount: number; ownerTransferAmount?: number }
  | { success: false; error: string };

export type ApplyNoShowResult =
  | { success: true; refundAmount: number; ownerTransferAmount?: number }
  | { success: false; error: string };

/**
 * Cancel a pending rental request (renter only, no payment involved).
 */
export async function cancelPendingRequest(
  rentalRequestId: string,
  userId: string,
  context: { ipAddress?: string; userAgent?: string; reason?: string },
): Promise<void> {
  const request = await rentalDAL.getRentalRequestById(rentalRequestId, userId);
  if (!request) {
    throw new NotFoundError("Rental request", rentalRequestId);
  }
  if (request.renterId !== userId) {
    throw new ForbiddenError("Only the renter can cancel this rental request");
  }
  if (request.status !== "pending") {
    throw new ValidationError(
      "Only pending requests can be cancelled",
      "status",
    );
  }

  await rentalDAL.cancelRentalRequest(
    rentalRequestId,
    userId,
    context.reason ?? null,
  );

  await auditLogDAL.create({
    entityType: "rental_request",
    entityId: rentalRequestId,
    action: "rental_request.cancelled",
    userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  trackActivity(userId, "rental_cancelled", {
    rentalRequestId,
  });

  const [ownerUser, renterUser] = await Promise.all([
    userDAL.getUserById(request.ownerId),
    userDAL.getUserById(request.renterId),
  ]);

  if (ownerUser && renterUser) {
    await sendRentalCancelledNotification({
      recipientUserId: ownerUser.id,
      recipientName:
        `${ownerUser.firstName ?? ""} ${ownerUser.lastName ?? ""}`.trim() ||
        ownerUser.name,
      otherPartyName:
        `${renterUser.firstName ?? ""} ${renterUser.lastName ?? ""}`.trim() ||
        renterUser.name,
      listingName: request.listingName,
      rentalId: rentalRequestId,
      cancelledBy: "renter",
      cancellationReason: "Cancelled by renter",
    });
  }
}

/**
 * Cancel an approved rental (pre-pickup). Handles both renter and owner cancellation.
 */
export async function cancelApprovedRental(
  rentalRequestId: string,
  userId: string,
  cancelledBy: "renter" | "owner",
  context: { ipAddress?: string; userAgent?: string; reason?: string },
): Promise<CancelApprovedRentalResult> {
  const ctx = await rentalDAL.getRentalCancellationContext(rentalRequestId);
  if (!ctx) {
    throw new NotFoundError("Rental", rentalRequestId);
  }
  if (ctx.status === "active") {
    throw new ValidationError(
      "Cancellation not allowed for active rentals",
      "status",
    );
  }
  if (ctx.status !== "approved") {
    throw new ValidationError("Rental is not in approved status", "status");
  }
  const now = new Date();

  const isRenter = ctx.renterId === userId;
  const isOwner = ctx.ownerId === userId;
  if (cancelledBy === "renter" && !isRenter) {
    throw new ForbiddenError("Only the renter can cancel as renter");
  }
  if (cancelledBy === "owner" && !isOwner) {
    throw new ForbiddenError("Only the owner can cancel as owner");
  }

  const rentalPriceDollars = parseFloat(ctx.rentalPrice);
  const totalChargeDollars = parseFloat(ctx.totalChargeAmount);

  const calc =
    cancelledBy === "owner"
      ? calculateOwnerCancellationRefund(totalChargeDollars)
      : calculateRenterCancellationRefund(
          rentalPriceDollars,
          ctx.startDate,
          now,
        );

  if (!ctx.rentalChargeId || !ctx.paymentId) {
    return { success: false, error: "Missing payment or charge data" };
  }
  if (ctx.paymentStatus === "refunded") {
    return {
      success: true,
      refundAmount: calc.refundAmountCents / 100,
      ownerTransferAmount:
        calc.ownerTransferAmountCents > 0
          ? calc.ownerTransferAmountCents / 100
          : undefined,
    };
  }

  const refundResult = await processRefund({
    rentalId: ctx.rentalId,
    chargeId: ctx.rentalChargeId,
    refundAmountCents: calc.refundAmountCents,
    reason: calc.refundReason,
  });

  if (!refundResult.success) {
    return { success: false, error: refundResult.error };
  }

  const refundedAt = new Date();
  await paymentDAL.recordRefund(ctx.paymentId, {
    refundedAt,
    refundAmount: (calc.refundAmountCents / 100).toFixed(2),
    refundReason: calc.refundReason,
  });

  const depositStatus = ctx.depositHoldStatus;
  if (depositStatus === "held" && ctx.securityDepositAuthId) {
    try {
      await releaseDepositHold(ctx.securityDepositAuthId);
      await paymentLifecycleDAL.updateDepositHoldStatus(
        ctx.rentalId,
        "released",
        {
          depositReleasedAt: new Date(),
        },
      );
    } catch {
      await paymentLifecycleDAL.updateDepositHoldStatus(
        ctx.rentalId,
        "release_failed",
      );
      await sendOpsAlert({
        event: "deposit_release_failed_on_cancel",
        rentalId: ctx.rentalId,
        message: "Deposit hold release failed during cancellation",
        sendEmailAlert: true,
      });
    }
  } else if (depositStatus === "scheduled") {
    await paymentLifecycleDAL.updateDepositHoldStatus(ctx.rentalId, "released");
  }

  let ownerTransferAmountDollars: number | undefined;
  if (calc.ownerTransferAmountCents > 0 && ctx.ownerConnectedAccountId) {
    const transferResult = await createOwnerTransfer({
      rentalId: ctx.rentalId,
      rentalRequestId: ctx.rentalRequestId,
      ownerId: ctx.ownerId,
      ownerConnectedAccountId: ctx.ownerConnectedAccountId,
      rentalChargeId: ctx.rentalChargeId,
      ownerPayoutAmount: calc.ownerTransferAmountCents / 100,
    });
    if (transferResult.success) {
      ownerTransferAmountDollars = calc.ownerTransferAmountCents / 100;
      await paymentLifecycleDAL.updateOwnerTransferStatus(
        ctx.rentalId,
        "completed",
        {
          stripeTransferId: transferResult.transferId,
          ownerTransferredAt: new Date(),
        },
      );
    } else {
      await paymentLifecycleDAL.updateOwnerTransferStatus(
        ctx.rentalId,
        "failed",
      );
      await sendOpsAlert({
        event: "owner_transfer_failed_on_cancel",
        rentalId: ctx.rentalId,
        message: transferResult.error,
        sendEmailAlert: true,
      });
    }
  }

  const cancellationReason: CancellationReason =
    cancelledBy === "renter" ? "renter_cancellation" : "owner_cancellation";
  await rentalDAL.cancelApprovedRental(
    rentalRequestId,
    userId,
    cancellationReason,
    context.reason ?? null,
  );

  await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
    depositHoldStatus: "released",
    ...(ownerTransferAmountDollars != null
      ? { ownerTransferStatus: "completed" as const }
      : {}),
  });

  await auditLogDAL.create({
    entityType: "rental_request",
    entityId: rentalRequestId,
    action: "rental_request.cancelled",
    userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  const opsEvent =
    cancelledBy === "renter"
      ? "renter_cancellation_post_approval"
      : "owner_cancellation";
  await sendOpsAlert({
    event: opsEvent,
    rentalId: ctx.rentalId,
    message: `${cancelledBy} cancelled approved rental`,
    metadata: { rentalRequestId, refundAmount: calc.refundAmountCents / 100 },
    sendEmailAlert: true,
  });

  const [ownerUser, renterUser] = await Promise.all([
    userDAL.getUserById(ctx.ownerId),
    userDAL.getUserById(ctx.renterId),
  ]);
  const renterName =
    (renterUser &&
      `${renterUser.firstName ?? ""} ${renterUser.lastName ?? ""}`.trim()) ||
    renterUser?.name ||
    "Renter";
  const ownerName =
    (ownerUser &&
      `${ownerUser.firstName ?? ""} ${ownerUser.lastName ?? ""}`.trim()) ||
    ownerUser?.name ||
    "Owner";

  if (cancelledBy === "renter" && ownerUser) {
    await sendRentalCancelledNotification({
      recipientUserId: ownerUser.id,
      recipientName: ownerName,
      otherPartyName: renterName,
      listingName: ctx.listingName,
      rentalId: rentalRequestId,
      cancelledBy: "renter",
      cancellationReason: "Renter cancelled",
    });
  }
  if (cancelledBy === "owner" && renterUser) {
    await sendRentalCancelledNotification({
      recipientUserId: renterUser.id,
      recipientName: renterName,
      otherPartyName: ownerName,
      listingName: ctx.listingName,
      rentalId: rentalRequestId,
      cancelledBy: "owner",
      cancellationReason: "Owner cancelled",
    });
  }

  if (renterUser) {
    await sendNotification({
      userId: renterUser.id,
      type: "payment_refunded",
      title: "Refund Processed",
      message: `Your refund of $${(calc.refundAmountCents / 100).toFixed(2)} has been processed for ${ctx.listingName}.`,
      data: {
        rentalId: ctx.rentalId,
        rentalRequestId,
        refundAmount: String(calc.refundAmountCents / 100),
      },
      linkUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app"}/dashboard/rental/${rentalRequestId}`,
    });
  }

  return {
    success: true,
    refundAmount: calc.refundAmountCents / 100,
    ...(ownerTransferAmountDollars != null && {
      ownerTransferAmount: ownerTransferAmountDollars,
    }),
  };
}

/**
 * Apply a no-show outcome (ops-triggered).
 */
export async function applyNoShow(
  rentalRequestId: string,
  noShowType: "renter_no_show" | "owner_no_show",
  opsUserId: string,
): Promise<ApplyNoShowResult> {
  const ctx = await rentalDAL.getRentalCancellationContext(rentalRequestId);
  if (!ctx) {
    throw new NotFoundError("Rental", rentalRequestId);
  }
  if (ctx.status === "cancelled") {
    throw new ValidationError("Rental is already cancelled", "status");
  }
  if (ctx.paymentStatus === "refunded") {
    throw new ValidationError("Payment is already refunded", "paymentStatus");
  }

  const rentalPriceDollars = parseFloat(ctx.rentalPrice);
  const totalChargeDollars = parseFloat(ctx.totalChargeAmount);
  const calc = calculateNoShowRefund(
    rentalPriceDollars,
    totalChargeDollars,
    noShowType,
  );

  if (!ctx.rentalChargeId || !ctx.paymentId) {
    return { success: false, error: "Missing payment or charge data" };
  }

  const refundResult = await processRefund({
    rentalId: ctx.rentalId,
    chargeId: ctx.rentalChargeId,
    refundAmountCents: calc.refundAmountCents,
    reason: calc.refundReason,
  });

  if (!refundResult.success) {
    return { success: false, error: refundResult.error };
  }

  await paymentDAL.recordRefund(ctx.paymentId, {
    refundedAt: new Date(),
    refundAmount: (calc.refundAmountCents / 100).toFixed(2),
    refundReason: calc.refundReason,
  });

  const depositStatus = ctx.depositHoldStatus;
  if (depositStatus === "held" && ctx.securityDepositAuthId) {
    try {
      await releaseDepositHold(ctx.securityDepositAuthId);
      await paymentLifecycleDAL.updateDepositHoldStatus(
        ctx.rentalId,
        "released",
        {
          depositReleasedAt: new Date(),
        },
      );
    } catch {
      await paymentLifecycleDAL.updateDepositHoldStatus(
        ctx.rentalId,
        "release_failed",
      );
      await sendOpsAlert({
        event: "deposit_release_failed_no_show",
        rentalId: ctx.rentalId,
        message: "Deposit release failed during no-show processing",
        sendEmailAlert: true,
      });
    }
  } else if (depositStatus === "scheduled") {
    await paymentLifecycleDAL.updateDepositHoldStatus(ctx.rentalId, "released");
  }

  let ownerTransferAmountDollars: number | undefined;
  if (
    calc.ownerTransferAmountCents > 0 &&
    ctx.ownerConnectedAccountId &&
    noShowType === "renter_no_show"
  ) {
    const transferResult = await createOwnerTransfer({
      rentalId: ctx.rentalId,
      rentalRequestId: ctx.rentalRequestId,
      ownerId: ctx.ownerId,
      ownerConnectedAccountId: ctx.ownerConnectedAccountId,
      rentalChargeId: ctx.rentalChargeId,
      ownerPayoutAmount: calc.ownerTransferAmountCents / 100,
    });
    if (transferResult.success) {
      ownerTransferAmountDollars = calc.ownerTransferAmountCents / 100;
      await paymentLifecycleDAL.updateOwnerTransferStatus(
        ctx.rentalId,
        "completed",
        {
          stripeTransferId: transferResult.transferId,
          ownerTransferredAt: new Date(),
        },
      );
    } else {
      await paymentLifecycleDAL.updateOwnerTransferStatus(
        ctx.rentalId,
        "failed",
      );
      await sendOpsAlert({
        event: "owner_transfer_failed_no_show",
        rentalId: ctx.rentalId,
        message: transferResult.error,
        sendEmailAlert: true,
      });
    }
  }

  const cancellationReason: CancellationReason = noShowType;
  await rentalDAL.cancelApprovedRental(
    rentalRequestId,
    opsUserId,
    cancellationReason,
  );

  await paymentLifecycleDAL.markCancelled(ctx.rentalId, {
    depositHoldStatus: "released",
    ...(ownerTransferAmountDollars != null
      ? { ownerTransferStatus: "completed" as const }
      : {}),
  });

  await auditLogDAL.create({
    entityType: "rental_request",
    entityId: rentalRequestId,
    action: "no_show_applied",
    userId: opsUserId,
    metadata: { noShowType },
  });

  await sendOpsAlert({
    event: noShowType,
    rentalId: ctx.rentalId,
    message: `No-show applied: ${noShowType}`,
    metadata: { rentalRequestId, refundAmount: calc.refundAmountCents / 100 },
    sendEmailAlert: true,
  });

  return {
    success: true,
    refundAmount: calc.refundAmountCents / 100,
    ...(ownerTransferAmountDollars != null && {
      ownerTransferAmount: ownerTransferAmountDollars,
    }),
  };
}

/**
 * Entry point: cancel a rental (pending or approved). Determines status and caller role, then delegates.
 */
export async function cancelRental(
  rentalRequestId: string,
  userId: string,
  context: { ipAddress?: string; userAgent?: string; reason?: string },
): Promise<
  | { success: true; refundAmount?: number; ownerTransferAmount?: number }
  | { success: false; error: string }
> {
  const request = await rentalDAL.getRentalRequestById(rentalRequestId, userId);
  if (!request) {
    throw new NotFoundError("Rental request", rentalRequestId);
  }

  const isRenter = request.renterId === userId;
  const isOwner = request.ownerId === userId;
  if (!isRenter && !isOwner) {
    throw new ForbiddenError("You are not authorized to cancel this rental");
  }

  if (request.status === "pending") {
    if (!isRenter) {
      throw new ForbiddenError("Only the renter can cancel a pending request");
    }
    await cancelPendingRequest(rentalRequestId, userId, context);
    return { success: true };
  }

  if (request.status === "approved") {
    const cancelledBy = isRenter ? "renter" : "owner";
    return cancelApprovedRental(rentalRequestId, userId, cancelledBy, context);
  }

  if (request.status === "active") {
    throw new ValidationError(
      "Cancellation not allowed for active rentals",
      "status",
    );
  }

  throw new ValidationError(
    "Rental cannot be cancelled in its current status",
    "status",
  );
}

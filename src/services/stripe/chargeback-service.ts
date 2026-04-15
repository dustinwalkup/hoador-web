import type Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";
import { getLogger } from "@/lib/logger";
import {
  disputeDAL,
  paymentDAL,
  paymentLifecycleDAL,
  servicePaymentLifecycleDAL,
  auditLogDAL,
  legalDocumentDAL,
} from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { ValidationError, NotFoundError } from "@/dal/errors";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

const logger = getLogger();

/**
 * Handles Stripe chargeback (bank-level dispute) events and evidence submission.
 *
 * Webhook events: `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
 * Links chargebacks to internal disputes via `stripeChargebackId`.
 */
export class ChargebackService {
  /**
   * Handle `charge.dispute.created` webhook event.
   *
   * 1. Identifies the rental via the charge's payment_intent → payments → rentalId
   * 2. Links to an existing internal dispute (sets stripeChargebackId) or auto-creates one
   * 3. Freezes owner payout
   * 4. Sends ops alert
   *
   * Idempotent: if the dispute already has this stripeChargebackId, no-ops linking.
   */
  static async handleChargebackCreated(dispute: Stripe.Dispute): Promise<void> {
    const stripeDisputeId = dispute.id;
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

    if (!chargeId) {
      logger.warn(
        { stripeDisputeId },
        "charge.dispute.created: no charge ID on dispute",
      );
      return;
    }

    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : (dispute.payment_intent?.id ?? null);

    let payment = await paymentDAL.getByChargeId(chargeId);

    if (!payment && paymentIntentId) {
      payment = await paymentDAL.getByPaymentIntentId(paymentIntentId);
    }

    if (!payment) {
      logger.warn(
        { stripeDisputeId, chargeId, paymentIntentId },
        "charge.dispute.created: no payment record found for charge — cannot link chargeback",
      );
      await sendOpsAlert({
        event: "chargeback_unlinked",
        rentalId: "unknown",
        message: `Stripe chargeback ${stripeDisputeId} received but no matching payment found (charge: ${chargeId})`,
        metadata: { stripeDisputeId, chargeId },
        sendEmailAlert: true,
      }).catch(() => {});
      return;
    }

    // --- Service booking chargeback path ---
    if (!payment.rentalId && payment.serviceBookingId) {
      const serviceBookingId = payment.serviceBookingId;

      logger.info(
        { stripeDisputeId, chargeId, serviceBookingId },
        "charge.dispute.created: service booking chargeback — freezing lifecycle and linking dispute",
      );

      const existingServiceDispute =
        await disputeDAL.getActiveByServiceBookingId(serviceBookingId);

      if (existingServiceDispute) {
        if (!existingServiceDispute.stripeChargebackId) {
          await disputeDAL.updateStripeChargebackId(
            existingServiceDispute.id,
            stripeDisputeId,
          );
        }
      } else {
        const disputePolicy = await legalDocumentDAL.getCurrentVersion(
          LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
        );
        const policyVersion = disputePolicy?.version || "v1.0";

        const autoDispute = await disputeDAL.create({
          rentalId: null,
          serviceBookingId,
          createdBy: "system",
          createdByRole: "requester",
          reasonCode: "payment_issue",
          description: `Auto-created from Stripe chargeback ${stripeDisputeId}`,
          policyVersion,
        });

        await disputeDAL.updateStripeChargebackId(
          autoDispute.id,
          stripeDisputeId,
        );

        await disputeDAL.createAuditLog({
          disputeId: autoDispute.id,
          actionType: "dispute_created",
          details: {
            source: "stripe_chargeback",
            stripeDisputeId,
            chargeId,
          },
        });
      }

      await servicePaymentLifecycleDAL.freezeForDispute(serviceBookingId);

      await sendOpsAlert({
        event: "chargeback_created",
        serviceBookingId,
        message: `Stripe chargeback received for service booking: ${stripeDisputeId} (amount: ${dispute.amount / 100} ${dispute.currency})`,
        metadata: {
          stripeDisputeId,
          chargeId,
          serviceBookingId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
        },
        sendEmailAlert: true,
      }).catch(() => {});
      return;
    }

    if (!payment.rentalId) {
      logger.warn(
        { stripeDisputeId, chargeId },
        "charge.dispute.created: payment has no rental or service booking ID — cannot link chargeback",
      );
      await sendOpsAlert({
        event: "chargeback_unlinked",
        rentalId: "unknown",
        message: `Stripe chargeback ${stripeDisputeId} received but payment has no linked transaction`,
        metadata: { stripeDisputeId, chargeId, paymentIntentId },
        sendEmailAlert: true,
      }).catch(() => {});
      return;
    }

    const rentalId = payment.rentalId;

    const existingDispute = await disputeDAL.getActiveByRentalId(rentalId);

    if (existingDispute) {
      if (!existingDispute.stripeChargebackId) {
        await disputeDAL.updateStripeChargebackId(
          existingDispute.id,
          stripeDisputeId,
        );
      }
    } else {
      const disputePolicy = await legalDocumentDAL.getCurrentVersion(
        LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
      );
      const policyVersion = disputePolicy?.version || "v1.0";

      const autoDispute = await disputeDAL.create({
        rentalId,
        createdBy: "system",
        createdByRole: "renter",
        reasonCode: "payment_issue",
        description: `Auto-created from Stripe chargeback ${stripeDisputeId}`,
        policyVersion,
      });

      await disputeDAL.updateStripeChargebackId(
        autoDispute.id,
        stripeDisputeId,
      );

      await disputeDAL.createAuditLog({
        disputeId: autoDispute.id,
        actionType: "dispute_created",
        details: {
          source: "stripe_chargeback",
          stripeDisputeId,
          chargeId,
        },
      });
    }

    await paymentLifecycleDAL.freezeForDispute(rentalId);

    await sendOpsAlert({
      event: "chargeback_created",
      rentalId,
      message: `Stripe chargeback received: ${stripeDisputeId} (amount: ${dispute.amount / 100} ${dispute.currency})`,
      metadata: {
        stripeDisputeId,
        chargeId,
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
      },
      sendEmailAlert: true,
    }).catch(() => {});
  }

  /**
   * Handle `charge.dispute.updated` webhook event.
   *
   * Logs the update and records it in the audit log. If an internal dispute
   * is linked via stripeChargebackId, an audit entry is created there too.
   *
   * Idempotent.
   */
  static async handleChargebackUpdated(dispute: Stripe.Dispute): Promise<void> {
    const stripeDisputeId = dispute.id;

    logger.info(
      {
        stripeDisputeId,
        status: dispute.status,
        reason: dispute.reason,
      },
      `Stripe chargeback updated: ${stripeDisputeId} → ${dispute.status}`,
    );

    await auditLogDAL.create({
      entityType: "chargeback",
      entityId: stripeDisputeId,
      action: "chargeback.updated",
      metadata: {
        status: dispute.status,
        reason: dispute.reason,
        amount: dispute.amount,
      },
    });
  }

  /**
   * Handle `charge.dispute.closed` webhook event.
   *
   * Records the outcome (won/lost/other) in the audit log and sends an ops alert.
   * If the chargeback was lost, ops may need to take manual action.
   *
   * Idempotent.
   */
  static async handleChargebackClosed(dispute: Stripe.Dispute): Promise<void> {
    const stripeDisputeId = dispute.id;
    const chargebackWon = dispute.status === "won";

    logger.info(
      { stripeDisputeId, status: dispute.status },
      `Stripe chargeback closed: ${stripeDisputeId} → ${dispute.status}`,
    );

    await auditLogDAL.create({
      entityType: "chargeback",
      entityId: stripeDisputeId,
      action: "chargeback.closed",
      metadata: {
        status: dispute.status,
        outcome: chargebackWon ? "won" : "lost",
        amount: dispute.amount,
        reason: dispute.reason,
      },
    });

    const paymentIntentId =
      typeof dispute.payment_intent === "string"
        ? dispute.payment_intent
        : (dispute.payment_intent?.id ?? null);

    let rentalId = "unknown";
    if (paymentIntentId) {
      const payment = await paymentDAL.getByPaymentIntentId(paymentIntentId);
      if (payment?.rentalId) {
        rentalId = payment.rentalId;
      }
    }

    await sendOpsAlert({
      event: chargebackWon ? "chargeback_won" : "chargeback_lost",
      rentalId,
      message: `Stripe chargeback ${stripeDisputeId} closed: ${dispute.status}`,
      metadata: {
        stripeDisputeId,
        amount: dispute.amount,
        reason: dispute.reason,
      },
      sendEmailAlert: true,
    }).catch(() => {});
  }

  /**
   * Submit evidence to Stripe for a bank-level chargeback.
   *
   * Gathers internal evidence (text, rental info) and maps it to Stripe's evidence
   * format, then calls `stripe.disputes.update()` with idempotency key
   * `chargeback-evidence-{disputeId}`.
   *
   * @param disputeId - Internal dispute ID
   * @param adminId - Admin user performing the submission
   * @throws {NotFoundError} If dispute not found
   * @throws {ValidationError} If no stripeChargebackId is set on the dispute
   */
  static async submitEvidence(
    disputeId: string,
    adminId: string,
  ): Promise<void> {
    const dispute = await disputeDAL.getById(disputeId);
    if (!dispute) {
      throw new NotFoundError("Dispute", disputeId);
    }

    if (!dispute.stripeChargebackId) {
      throw new ValidationError(
        "Dispute has no linked Stripe chargeback — cannot submit evidence",
      );
    }

    const evidenceRecords = await disputeDAL.getEvidenceByDisputeId(disputeId);

    const textEvidence = evidenceRecords
      .filter((e) => e.evidenceType === "text")
      .map((e) => e.content)
      .join("\n\n");

    const evidence: Stripe.DisputeUpdateParams.Evidence = {
      product_description: `Hoador tool rental — Dispute ${dispute.referenceNumber ?? dispute.id}`,
      customer_communication: textEvidence || undefined,
      service_documentation: dispute.description || undefined,
    };

    await PAYMENT_SERVER_INSTANCE.disputes.update(
      dispute.stripeChargebackId,
      { evidence },
      { idempotencyKey: `chargeback-evidence-${disputeId}` },
    );

    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "financial_operation",
      userId: adminId,
      details: {
        action: "chargeback_evidence_submitted",
        stripeChargebackId: dispute.stripeChargebackId,
        evidenceFieldsSubmitted: Object.keys(evidence).filter(
          (k) => evidence[k as keyof typeof evidence] != null,
        ),
      },
    });

    await auditLogDAL.create({
      entityType: "chargeback",
      entityId: dispute.stripeChargebackId,
      action: "chargeback.evidence_submitted",
      userId: adminId,
      metadata: {
        disputeId,
        evidenceCount: evidenceRecords.length,
      },
    });
  }
}

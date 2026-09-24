import { userDAL } from "@/dal";
import type { DisputeWithRelations } from "@/dal/types";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { escapeHtml } from "@/lib/utils/escape-html";

/**
 * The two evidence-deadline notifications (P-E13-9, mobile Req 19.2.3):
 * `dispute_evidence_deadline_approaching` a day before the active deadline,
 * and `dispute_evidence_deadline_expired` when the deadline cron moves an
 * `evidence_requested` dispute to review.
 *
 * Both go to **both parties of either marketplace**. The expired notice used
 * to be sent inline by `DeadlineEnforcementService` for rental disputes only
 * (`if (dispute.rental)`), so a service dispute's parties heard nothing.
 *
 * `data.disputeId` is what the mobile app routes on (`/disputes/:id`) and
 * what its push handler refreshes. `linkUrl` is web's page for the same
 * dispute.
 */

interface DisputeParties {
  userIds: [string, string];
  listingName: string;
  subject: { rentalId: string } | { serviceBookingId: string };
}

/**
 * Both parties and what the dispute is about, from the relations `getById`
 * loads. Null for a dispute whose booking row is gone, which the callers
 * skip rather than guess at.
 */
export function disputeParties(
  dispute: DisputeWithRelations,
): DisputeParties | null {
  if (dispute.rental && dispute.rentalId) {
    return {
      userIds: [dispute.rental.renterId, dispute.rental.ownerId],
      listingName: dispute.rental.listing?.name ?? "your rental",
      subject: { rentalId: dispute.rentalId },
    };
  }
  if (dispute.serviceBooking && dispute.serviceBookingId) {
    return {
      userIds: [
        dispute.serviceBooking.requesterId,
        dispute.serviceBooking.providerId,
      ],
      listingName: dispute.serviceBooking.listing?.title ?? "your booking",
      subject: { serviceBookingId: dispute.serviceBookingId },
    };
  }
  return null;
}

function disputeUrl(disputeId: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  return `${baseUrl}/dashboard/disputes/${disputeId}`;
}

interface Copy {
  type:
    | "dispute_evidence_deadline_approaching"
    | "dispute_evidence_deadline_expired";
  title: string;
  message: string;
  subject: string;
  deadline: Date | null;
}

/**
 * Sends one notice to each party. A failure for one party never stops the
 * other, and is reported in the count rather than thrown: the caller records
 * that the reminder went out, and one bad address must not make the next run
 * re-notify the party who already got it.
 */
async function notifyBoth(
  dispute: DisputeWithRelations,
  parties: DisputeParties,
  copy: Copy,
): Promise<{ sent: number; failed: number }> {
  const linkUrl = disputeUrl(dispute.id);
  const results = await Promise.allSettled(
    parties.userIds.map(async (userId) => {
      const user = await userDAL.getUserById(userId);
      const result = await sendNotification({
        userId,
        type: copy.type,
        title: copy.title,
        message: copy.message,
        data: {
          disputeId: dispute.id,
          ...parties.subject,
          evidenceDeadline: copy.deadline?.toISOString() ?? null,
          listingName: parties.listingName,
        },
        linkUrl,
        ...(user?.email
          ? {
              email: {
                to: user.email,
                subject: copy.subject,
                // The message carries the listing's title, which its owner typed.
                html: `<p>${escapeHtml(copy.message)}</p><p><a href="${linkUrl}">View the dispute</a></p>`,
                text: `${copy.message}\n\n${linkUrl}`,
              },
            }
          : {}),
      });
      // An in-app insert that fails comes back as `success: false`, not a
      // throw. Counted as a failure all the same.
      if (!result.success)
        throw new Error(result.error ?? "notification failed");
    }),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return { sent: results.length - failed, failed };
}

/**
 * A day before the active evidence deadline. Worded without a clock time: the
 * server has no zone for the reader, and "within 24 hours" is exact for every
 * one of them. The app shows the countdown from `evidenceDeadline`.
 */
export async function sendEvidenceDeadlineApproaching(
  dispute: DisputeWithRelations,
  deadline: Date,
): Promise<{ sent: number; failed: number } | null> {
  const parties = disputeParties(dispute);
  if (!parties) return null;
  return notifyBoth(dispute, parties, {
    type: "dispute_evidence_deadline_approaching",
    title: "Less than a day to add evidence",
    message: `The evidence deadline for your dispute about ${parties.listingName} is within 24 hours. Add anything you want support to see before it closes.`,
    subject: `Less than a day to add evidence: ${parties.listingName}`,
    deadline,
  });
}

/** The deadline passed and the cron moved the dispute to review. */
export async function sendEvidenceDeadlineExpired(
  dispute: DisputeWithRelations,
): Promise<{ sent: number; failed: number } | null> {
  const parties = disputeParties(dispute);
  if (!parties) return null;
  return notifyBoth(dispute, parties, {
    type: "dispute_evidence_deadline_expired",
    title: "Evidence deadline passed",
    message: `The evidence deadline for your dispute about ${parties.listingName} has passed. Support is now reviewing it with the evidence already sent.`,
    subject: `Evidence deadline passed: ${parties.listingName}`,
    deadline: dispute.evidenceDeadline,
  });
}

import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { rentalDAL, serviceBookingDAL, userDAL } from "@/dal";
import type { DisputeWithRelations } from "@/dal/types";

type DisputeEventType = "created" | "evidence_requested" | "resolved";

/**
 * Format dispute reason code for display
 */
function formatReasonCode(reasonCode: string | null | undefined): string {
  if (!reasonCode) {
    return "Unknown";
  }

  const reasonMap: Record<string, string> = {
    damage: "Damage to Item",
    non_delivery: "Non-Delivery",
    quality_issue: "Quality Issue",
    cancellation: "Cancellation",
    payment_issue: "Payment Issue",
    renter_no_show: "Renter No-Show",
    owner_no_show: "Owner No-Show",
    requester_no_show: "Client No-Show",
    provider_no_show: "Provider No-Show",
    other: "Other",
  };

  return reasonMap[reasonCode] || reasonCode;
}

/**
 * Notifications for service-booking disputes (separate from rental flow).
 */
async function sendServiceBookingDisputeNotifications(
  dispute: DisputeWithRelations,
  eventType: DisputeEventType,
): Promise<void> {
  if (!dispute.serviceBookingId) {
    return;
  }

  const detail = dispute.serviceBooking
    ? {
        requesterId: dispute.serviceBooking.requesterId,
        providerId: dispute.serviceBooking.providerId,
        listingTitle: dispute.serviceBooking.listing?.title ?? "Service",
      }
    : await (async () => {
        const row = await serviceBookingDAL.getById(dispute.serviceBookingId!);
        if (!row) {
          console.error(
            `Service booking ${dispute.serviceBookingId} not found for dispute ${dispute.id}`,
          );
          return null;
        }
        return {
          requesterId: row.requesterId,
          providerId: row.providerId,
          listingTitle: row.listing.title,
        };
      })();

  if (!detail) {
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/disputes/${dispute.id}`;

  const requesterUser = await userDAL.getUserById(detail.requesterId);
  const providerUser = await userDAL.getUserById(detail.providerId);
  if (!requesterUser || !providerUser) {
    console.error(
      `Users not found for service dispute ${dispute.id}: requester=${detail.requesterId} provider=${detail.providerId}`,
    );
    return;
  }

  const createdByName = dispute.createdByUser
    ? `${dispute.createdByUser.firstName} ${dispute.createdByUser.lastName}`
    : "Unknown User";

  if (eventType === "created") {
    const notifyUserId =
      dispute.createdByRole === "requester"
        ? detail.providerId
        : detail.requesterId;
    const notifyUser =
      dispute.createdByRole === "requester" ? providerUser : requesterUser;
    const notifyName =
      dispute.createdByRole === "requester"
        ? `${providerUser.firstName ?? ""} ${providerUser.lastName ?? ""}`.trim()
        : `${requesterUser.firstName ?? ""} ${requesterUser.lastName ?? ""}`.trim();

    await sendNotification({
      userId: notifyUserId,
      type: "dispute_created",
      title: "New Dispute Filed",
      message: `${createdByName} has filed a dispute for ${detail.listingTitle}`,
      data: {
        disputeId: dispute.id,
        serviceBookingId: dispute.serviceBookingId,
        reasonCode: dispute.reasonCode,
        createdByRole: dispute.createdByRole,
        listingName: detail.listingTitle,
      },
      linkUrl,
      email: {
        to: notifyUser.email,
        subject: `Dispute Filed for ${detail.listingTitle}`,
        html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Dispute Filed</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  <h1 style="color: #333;">Hi ${notifyName},</h1>
                  <p>${createdByName} has filed a dispute regarding the service <strong>${detail.listingTitle}</strong>.</p>
                  <p><strong>Reason:</strong> ${formatReasonCode(dispute.reasonCode)}</p>
                  <p><strong>Description:</strong> ${dispute.description}</p>
                  <p><a href="${linkUrl}">View Dispute</a></p>
                  <p style="font-size: 12px; color: #999;">The Hoador Team</p>
                </body>
              </html>
            `,
        text: `Hi ${notifyName},\n\n${createdByName} filed a dispute for ${detail.listingTitle}.\nReason: ${formatReasonCode(dispute.reasonCode)}\n\nView: ${linkUrl}`,
      },
    }).catch((err) => {
      console.error(
        `Failed to send service dispute created notification:`,
        err,
      );
    });
    return;
  }

  if (eventType === "evidence_requested") {
    const deadlineDate = dispute.evidenceDeadline
      ? new Date(dispute.evidenceDeadline).toLocaleDateString()
      : "N/A";

    for (const u of [
      { id: detail.requesterId, user: requesterUser },
      { id: detail.providerId, user: providerUser },
    ]) {
      await sendNotification({
        userId: u.id,
        type: "dispute_evidence_requested",
        title: "Evidence Requested for Dispute",
        message: `Please submit evidence for the dispute regarding ${detail.listingTitle} by ${deadlineDate}`,
        data: {
          disputeId: dispute.id,
          serviceBookingId: dispute.serviceBookingId,
          evidenceDeadline: dispute.evidenceDeadline?.toISOString() ?? null,
          listingName: detail.listingTitle,
        },
        linkUrl,
        email: {
          to: u.user.email,
          subject: `Evidence Requested: ${detail.listingTitle}`,
          html: `<p>Evidence requested for dispute. Deadline: ${deadlineDate}. <a href="${linkUrl}">View</a></p>`,
          text: `Evidence requested. Deadline ${deadlineDate}. ${linkUrl}`,
        },
      }).catch(() => {
        /* non-critical */
      });
    }
    return;
  }

  if (eventType === "resolved") {
    const outcomeText = formatResolutionOutcome(dispute.resolutionOutcome);
    const title =
      dispute.resolutionOutcome === "dismissed"
        ? "Dispute Dismissed"
        : "Dispute Resolved";

    for (const u of [
      { id: detail.requesterId, user: requesterUser },
      { id: detail.providerId, user: providerUser },
    ]) {
      await sendNotification({
        userId: u.id,
        type: "dispute_resolved",
        title,
        message: `The dispute for ${detail.listingTitle} has been resolved: ${outcomeText}`,
        data: {
          disputeId: dispute.id,
          serviceBookingId: dispute.serviceBookingId,
          resolutionOutcome: dispute.resolutionOutcome,
        },
        linkUrl,
        email: {
          to: u.user.email,
          subject: `${title}: ${detail.listingTitle}`,
          html: `<p>Your dispute has been resolved: <strong>${outcomeText}</strong>. <a href="${linkUrl}">View details</a></p>`,
          text: `Dispute resolved: ${outcomeText}. ${linkUrl}`,
        },
      }).catch(() => {
        /* non-critical */
      });
    }
  }
}

/**
 * Send dispute notifications to relevant parties
 * Handles notifications for dispute creation, evidence requests, and resolution
 */
export async function sendDisputeNotifications(
  dispute: DisputeWithRelations,
  eventType: DisputeEventType,
): Promise<void> {
  try {
    if (dispute.serviceBookingId) {
      await sendServiceBookingDisputeNotifications(dispute, eventType);
      return;
    }

    if (!dispute.rentalId) {
      console.error(`Dispute ${dispute.id} has no rental or service booking`);
      return;
    }

    // Get rental details to access renter and owner information
    const rental = await rentalDAL.getRentalDetailsById(
      dispute.rentalId,
      dispute.createdBy,
    );

    if (!rental) {
      console.error(
        `Rental ${dispute.rentalId} not found for dispute ${dispute.id}`,
      );
      return;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
    const linkUrl = `${baseUrl}/dashboard/disputes/${dispute.id}`;

    // Get user details for email addresses
    const renterUser = await userDAL.getUserById(rental.renterId);
    const ownerUser = await userDAL.getUserById(rental.ownerId);

    if (!renterUser || !ownerUser) {
      console.error(
        `Users not found for dispute ${dispute.id}: renter=${rental.renterId}, owner=${rental.ownerId}`,
      );
      return;
    }

    const createdByName = dispute.createdByUser
      ? `${dispute.createdByUser.firstName} ${dispute.createdByUser.lastName}`
      : "Unknown User";

    // Handle different event types
    switch (eventType) {
      case "created": {
        // Notify the other party (not the creator)
        const notifyUserId =
          dispute.createdByRole === "renter" ? rental.ownerId : rental.renterId;
        const notifyUser =
          dispute.createdByRole === "renter" ? ownerUser : renterUser;
        const notifyUserName =
          dispute.createdByRole === "renter"
            ? rental.ownerName
            : rental.renterName;

        await sendNotification({
          userId: notifyUserId,
          type: "dispute_created",
          title: "New Dispute Filed",
          message: `${createdByName} has filed a dispute for ${rental.listingName}`,
          data: {
            disputeId: dispute.id,
            rentalId: dispute.rentalId,
            reasonCode: dispute.reasonCode,
            createdByRole: dispute.createdByRole,
            listingName: rental.listingName,
          },
          linkUrl,
          email: {
            to: notifyUser.email,
            subject: `Dispute Filed for ${rental.listingName}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Dispute Filed</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <h2 style="color: #92400e; margin-top: 0;">⚠️ Dispute Filed</h2>
                  </div>
                  
                  <h1 style="color: #333; margin-bottom: 20px;">
                    Hi ${notifyUserName},
                  </h1>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    ${createdByName} has filed a dispute regarding the rental of <strong>${rental.listingName}</strong>.
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #2563eb; margin-top: 0;">Dispute Details</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li><strong>Listing:</strong> ${rental.listingName}</li>
                      <li><strong>Reason:</strong> ${formatReasonCode(dispute.reasonCode)}</li>
                      <li><strong>Filed by:</strong> ${createdByName}</li>
                      <li><strong>Description:</strong> ${dispute.description}</li>
                    </ul>
                  </div>
                  
                  <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="color: #1e40af; margin-top: 0;">What Happens Next?</h3>
                    <p style="margin: 10px 0; color: #1e3a8a;">
                      Our team will review this dispute and may request additional evidence from both parties. 
                      You'll be notified if any action is required from you.
                    </p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkUrl}" 
                       style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      View Dispute
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you have any questions or concerns, please contact our support team.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
                    <p>The Hoador Team</p>
                  </div>
                </body>
              </html>
            `,
            text: `
Hi ${notifyUserName},

${createdByName} has filed a dispute regarding the rental of ${rental.listingName}.

Dispute Details:
- Listing: ${rental.listingName}
- Reason: ${formatReasonCode(dispute.reasonCode)}
- Filed by: ${createdByName}
- Description: ${dispute.description}

What Happens Next?
Our team will review this dispute and may request additional evidence from both parties. 
You'll be notified if any action is required from you.

View Dispute: ${linkUrl}

If you have any questions or concerns, please contact our support team.

The Hoador Team
            `.trim(),
          },
        }).catch((err) => {
          console.error(
            `Failed to send dispute created notification to ${notifyUserId}:`,
            err,
          );
        });

        break;
      }

      case "evidence_requested": {
        // Notify both parties that evidence is requested
        const deadlineDate = dispute.evidenceDeadline
          ? new Date(dispute.evidenceDeadline).toLocaleDateString()
          : "N/A";
        const deadlineTime = dispute.evidenceDeadline
          ? new Date(dispute.evidenceDeadline).toLocaleTimeString()
          : "N/A";

        // Notify renter
        await sendNotification({
          userId: rental.renterId,
          type: "dispute_evidence_requested",
          title: "Evidence Requested for Dispute",
          message: `Please submit evidence for the dispute regarding ${rental.listingName} by ${deadlineDate}`,
          data: {
            disputeId: dispute.id,
            rentalId: dispute.rentalId,
            evidenceDeadline: dispute.evidenceDeadline?.toISOString() || null,
            listingName: rental.listingName,
          },
          linkUrl,
          email: {
            to: renterUser.email,
            subject: `Evidence Requested: Dispute for ${rental.listingName}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Evidence Requested</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <h2 style="color: #92400e; margin-top: 0;">📋 Evidence Requested</h2>
                  </div>
                  
                  <h1 style="color: #333; margin-bottom: 20px;">
                    Hi ${rental.renterName},
                  </h1>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    We need additional evidence from you regarding the dispute for <strong>${rental.listingName}</strong>.
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #2563eb; margin-top: 0;">Evidence Deadline</h3>
                    <p style="font-size: 18px; font-weight: 600; color: #dc2626; margin: 10px 0;">
                      ${deadlineDate} at ${deadlineTime}
                    </p>
                    <p style="color: #666; margin-top: 10px;">
                      Please submit your evidence before this deadline. Late submissions may not be considered.
                    </p>
                  </div>
                  
                  <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="color: #1e40af; margin-top: 0;">What to Submit</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                      <li>Photos or images related to the dispute</li>
                      <li>Written descriptions or explanations</li>
                      <li>Any relevant documentation</li>
                    </ul>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkUrl}" 
                       style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      Submit Evidence
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you have any questions, please contact our support team.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
                    <p>The Hoador Team</p>
                  </div>
                </body>
              </html>
            `,
            text: `
Hi ${rental.renterName},

We need additional evidence from you regarding the dispute for ${rental.listingName}.

Evidence Deadline: ${deadlineDate} at ${deadlineTime}
Please submit your evidence before this deadline. Late submissions may not be considered.

What to Submit:
- Photos or images related to the dispute
- Written descriptions or explanations
- Any relevant documentation

Submit Evidence: ${linkUrl}

If you have any questions, please contact our support team.

The Hoador Team
            `.trim(),
          },
        }).catch((err) => {
          console.error(
            `Failed to send evidence requested notification to renter ${rental.renterId}:`,
            err,
          );
        });

        // Notify owner
        await sendNotification({
          userId: rental.ownerId,
          type: "dispute_evidence_requested",
          title: "Evidence Requested for Dispute",
          message: `Please submit evidence for the dispute regarding ${rental.listingName} by ${deadlineDate}`,
          data: {
            disputeId: dispute.id,
            rentalId: dispute.rentalId,
            evidenceDeadline: dispute.evidenceDeadline?.toISOString() || null,
            listingName: rental.listingName,
          },
          linkUrl,
          email: {
            to: ownerUser.email,
            subject: `Evidence Requested: Dispute for ${rental.listingName}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Evidence Requested</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <h2 style="color: #92400e; margin-top: 0;">📋 Evidence Requested</h2>
                  </div>
                  
                  <h1 style="color: #333; margin-bottom: 20px;">
                    Hi ${rental.ownerName},
                  </h1>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    We need additional evidence from you regarding the dispute for <strong>${rental.listingName}</strong>.
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #2563eb; margin-top: 0;">Evidence Deadline</h3>
                    <p style="font-size: 18px; font-weight: 600; color: #dc2626; margin: 10px 0;">
                      ${deadlineDate} at ${deadlineTime}
                    </p>
                    <p style="color: #666; margin-top: 10px;">
                      Please submit your evidence before this deadline. Late submissions may not be considered.
                    </p>
                  </div>
                  
                  <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <h3 style="color: #1e40af; margin-top: 0;">What to Submit</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                      <li>Photos or images related to the dispute</li>
                      <li>Written descriptions or explanations</li>
                      <li>Any relevant documentation</li>
                    </ul>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkUrl}" 
                       style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      Submit Evidence
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you have any questions, please contact our support team.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
                    <p>The Hoador Team</p>
                  </div>
                </body>
              </html>
            `,
            text: `
Hi ${rental.ownerName},

We need additional evidence from you regarding the dispute for ${rental.listingName}.

Evidence Deadline: ${deadlineDate} at ${deadlineTime}
Please submit your evidence before this deadline. Late submissions may not be considered.

What to Submit:
- Photos or images related to the dispute
- Written descriptions or explanations
- Any relevant documentation

Submit Evidence: ${linkUrl}

If you have any questions, please contact our support team.

The Hoador Team
            `.trim(),
          },
        }).catch((err) => {
          console.error(
            `Failed to send evidence requested notification to owner ${rental.ownerId}:`,
            err,
          );
        });

        break;
      }

      case "resolved": {
        // Notify both parties of resolution
        const outcomeText = formatResolutionOutcome(dispute.resolutionOutcome);
        const resolvedByName = dispute.resolvedByUser
          ? `${dispute.resolvedByUser.firstName} ${dispute.resolvedByUser.lastName}`
          : "Hoador Support";
        const resolvedTitle =
          dispute.resolutionOutcome === "dismissed"
            ? "Dispute Dismissed"
            : "Dispute Resolved";

        // Notify renter
        await sendNotification({
          userId: rental.renterId,
          type: "dispute_resolved",
          title: resolvedTitle,
          message: `The dispute for ${rental.listingName} has been resolved: ${outcomeText}`,
          data: {
            disputeId: dispute.id,
            rentalId: dispute.rentalId,
            resolutionOutcome: dispute.resolutionOutcome || null,
            listingName: rental.listingName,
          },
          linkUrl,
          email: {
            to: renterUser.email,
            subject: `Dispute Resolved: ${rental.listingName}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Dispute Resolved</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  
                  <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <h2 style="color: #065f46; margin-top: 0;">✅ Dispute Resolved</h2>
                  </div>
                  
                  <h1 style="color: #333; margin-bottom: 20px;">
                    Hi ${rental.renterName},
                  </h1>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    The dispute regarding <strong>${rental.listingName}</strong> has been resolved.
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #2563eb; margin-top: 0;">Resolution Details</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li><strong>Outcome:</strong> ${outcomeText}</li>
                      <li><strong>Resolved by:</strong> ${resolvedByName}</li>
                      <li><strong>Reason:</strong> ${dispute.resolutionReason || "N/A"}</li>
                    </ul>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkUrl}" 
                       style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      View Resolution
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you have any questions about this resolution, please contact our support team.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
                    <p>The Hoador Team</p>
                  </div>
                </body>
              </html>
            `,
            text: `
Hi ${rental.renterName},

The dispute regarding ${rental.listingName} has been resolved.

Resolution Details:
- Outcome: ${outcomeText}
- Resolved by: ${resolvedByName}
- Reason: ${dispute.resolutionReason || "N/A"}

View Resolution: ${linkUrl}

If you have any questions about this resolution, please contact our support team.

The Hoador Team
            `.trim(),
          },
        }).catch((err) => {
          console.error(
            `Failed to send dispute resolved notification to renter ${rental.renterId}:`,
            err,
          );
        });

        // Notify owner
        await sendNotification({
          userId: rental.ownerId,
          type: "dispute_resolved",
          title: resolvedTitle,
          message: `The dispute for ${rental.listingName} has been resolved: ${outcomeText}`,
          data: {
            disputeId: dispute.id,
            rentalId: dispute.rentalId,
            resolutionOutcome: dispute.resolutionOutcome || null,
            listingName: rental.listingName,
          },
          linkUrl,
          email: {
            to: ownerUser.email,
            subject: `Dispute Resolved: ${rental.listingName}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Dispute Resolved</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  ${EMAIL_LOGO_HTML}
                  
                  <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <h2 style="color: #065f46; margin-top: 0;">✅ Dispute Resolved</h2>
                  </div>
                  
                  <h1 style="color: #333; margin-bottom: 20px;">
                    Hi ${rental.ownerName},
                  </h1>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    The dispute regarding <strong>${rental.listingName}</strong> has been resolved.
                  </p>
                  
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #2563eb; margin-top: 0;">Resolution Details</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li><strong>Outcome:</strong> ${outcomeText}</li>
                      <li><strong>Resolved by:</strong> ${resolvedByName}</li>
                      <li><strong>Reason:</strong> ${dispute.resolutionReason || "N/A"}</li>
                    </ul>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkUrl}" 
                       style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                      View Resolution
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    If you have any questions about this resolution, please contact our support team.
                  </p>
                  
                  <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
                    <p>The Hoador Team</p>
                  </div>
                </body>
              </html>
            `,
            text: `
Hi ${rental.ownerName},

The dispute regarding ${rental.listingName} has been resolved.

Resolution Details:
- Outcome: ${outcomeText}
- Resolved by: ${resolvedByName}
- Reason: ${dispute.resolutionReason || "N/A"}

View Resolution: ${linkUrl}

If you have any questions about this resolution, please contact our support team.

The Hoador Team
            `.trim(),
          },
        }).catch((err) => {
          console.error(
            `Failed to send dispute resolved notification to owner ${rental.ownerId}:`,
            err,
          );
        });

        break;
      }
    }
  } catch (error) {
    console.error(
      `Failed to send dispute notifications for dispute ${dispute.id}:`,
      error,
    );
    // Don't throw - notifications are non-critical
  }
}

/**
 * Format resolution outcome for display
 */
function formatResolutionOutcome(outcome: string | null | undefined): string {
  if (!outcome) return "Resolved";

  const outcomeMap: Record<string, string> = {
    favor_renter: "In Favor of Renter / Requester",
    favor_provider: "In Favor of Provider / Owner",
    partial_renter: "Partial Resolution — Favor Renter",
    partial_provider: "Partial Resolution — Favor Provider",
    dismissed: "Dismissed — no funds captured",
  };

  return outcomeMap[outcome] || outcome;
}

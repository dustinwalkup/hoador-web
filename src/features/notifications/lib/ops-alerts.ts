import { escapeHtml } from "@/lib/utils/escape-html";
import { getLogger } from "@/lib/logger";
import { sendEmail } from "@/features/notifications/utils/send-email";

const OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL;

interface OpsAlertParams {
  event: string;
  /** Rental id when the alert relates to a rental flow. */
  rentalId?: string;
  /** Service booking id when the alert relates to HOA services. */
  serviceBookingId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  /** If true, also sends an email alert (for critical failures). */
  sendEmailAlert?: boolean;
}

/**
 * Send an operations alert: always logs with structured logger,
 * optionally sends email if OPS_ALERT_EMAIL is configured and sendEmailAlert is true.
 */
export async function sendOpsAlert(params: OpsAlertParams): Promise<void> {
  const {
    event,
    rentalId,
    serviceBookingId,
    message,
    metadata,
    sendEmailAlert,
  } = params;

  const idLabel =
    rentalId != null && rentalId !== ""
      ? `Rental ${rentalId}`
      : serviceBookingId != null && serviceBookingId !== ""
        ? `Service booking ${serviceBookingId}`
        : "—";

  // Always log with structured logger
  getLogger().error(
    {
      alertType: "ops",
      event,
      rentalId,
      serviceBookingId,
      ...metadata,
    },
    message,
  );

  // Send email if configured and requested
  if (sendEmailAlert && OPS_ALERT_EMAIL) {
    const metadataLines = metadata
      ? Object.entries(metadata)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join("\n")
      : "";

    await sendEmail({
      to: OPS_ALERT_EMAIL,
      subject: `[Hoador Ops] ${event} — ${idLabel}`,
      html: `
        <h2>Operations Alert</h2>
        <p><strong>Event:</strong> ${escapeHtml(event)}</p>
        ${rentalId ? `<p><strong>Rental ID:</strong> ${escapeHtml(rentalId)}</p>` : ""}
        ${serviceBookingId ? `<p><strong>Service booking ID:</strong> ${escapeHtml(serviceBookingId)}</p>` : ""}
        <p><strong>Message:</strong> ${escapeHtml(message)}</p>
        ${metadataLines ? `<pre>${escapeHtml(metadataLines)}</pre>` : ""}
        <p><em>Timestamp: ${new Date().toISOString()}</em></p>
      `,
      text: `[Hoador Ops] ${event}\n${idLabel}\n${message}\n${metadataLines}\nTimestamp: ${new Date().toISOString()}`,
    }).catch((err) => {
      getLogger().error(
        {
          alertType: "ops",
          event: "ops_email_failed",
          rentalId,
          serviceBookingId,
          error: String(err),
        },
        "Failed to send ops alert email",
      );
    });
  }
}

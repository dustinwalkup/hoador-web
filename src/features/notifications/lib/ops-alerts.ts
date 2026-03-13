import { getLogger } from "@/lib/logger";
import { sendEmail } from "@/features/notifications/utils/send-email";

const OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL;

interface OpsAlertParams {
  event: string;
  rentalId: string;
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
  const { event, rentalId, message, metadata, sendEmailAlert } = params;

  // Always log with structured logger
  getLogger().error(
    { alertType: "ops", event, rentalId, ...metadata },
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
      subject: `[Hoador Ops] ${event} — Rental ${rentalId}`,
      html: `
        <h2>Operations Alert</h2>
        <p><strong>Event:</strong> ${event}</p>
        <p><strong>Rental ID:</strong> ${rentalId}</p>
        <p><strong>Message:</strong> ${message}</p>
        ${metadataLines ? `<pre>${metadataLines}</pre>` : ""}
        <p><em>Timestamp: ${new Date().toISOString()}</em></p>
      `,
      text: `[Hoador Ops] ${event}\nRental: ${rentalId}\n${message}\n${metadataLines}\nTimestamp: ${new Date().toISOString()}`,
    }).catch((err) => {
      getLogger().error(
        {
          alertType: "ops",
          event: "ops_email_failed",
          rentalId,
          error: String(err),
        },
        "Failed to send ops alert email",
      );
    });
  }
}

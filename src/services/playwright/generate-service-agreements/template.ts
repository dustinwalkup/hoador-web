/**
 * Template and version for the Hoador Service Agreement.
 * Used for per-booking PDF generation with placeholders filled from booking data.
 */

export const SERVICE_AGREEMENT_TEMPLATE_VERSION = "1.0";

/**
 * Data required to fill the service agreement template.
 * All string fields use "N/A" when missing (optional fields).
 */
export interface ServiceAgreementData {
  providerName: string;
  requesterName: string;
  serviceDescription: string;
  scheduledDateTime: string;
  durationOrScope: string;
  totalAmount: string;
}

const DEFAULT = "N/A";

import { escapeHtml } from "@/lib/utils/escape-html";

export interface RenderServiceTemplateOptions {
  /** Base64 data URL for the logo image (e.g. data:image/png;base64,...). */
  logoDataUrl?: string;
}

/**
 * Renders the service agreement HTML template with the given data.
 *
 * @param data - Service agreement payload.
 * @param options - Optional logo data URL for branding.
 * @returns HTML string ready for PDF generation.
 */
export function renderServiceAgreementTemplate(
  data: ServiceAgreementData,
  options?: RenderServiceTemplateOptions,
): string {
  const providerName = data.providerName?.trim() || DEFAULT;
  const requesterName = data.requesterName?.trim() || DEFAULT;
  const serviceDescription = data.serviceDescription?.trim() || DEFAULT;
  const scheduledDateTime = data.scheduledDateTime?.trim() || DEFAULT;
  const durationOrScope = data.durationOrScope?.trim() || DEFAULT;
  const totalAmount = data.totalAmount?.trim() || DEFAULT;

  const logoImg = options?.logoDataUrl
    ? `<img src="${options.logoDataUrl}" alt="Hoador" class="logo" />`
    : "";

  return SERVICE_AGREEMENT_HTML.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const map: Record<string, string> = {
      PROVIDER_NAME: escapeHtml(providerName),
      REQUESTER_NAME: escapeHtml(requesterName),
      SERVICE_DESCRIPTION: escapeHtml(serviceDescription),
      SCHEDULED_DATE_TIME: escapeHtml(scheduledDateTime),
      DURATION_OR_SCOPE: escapeHtml(durationOrScope),
      TOTAL_AMOUNT: escapeHtml(totalAmount),
      LOGO_IMG: logoImg,
    };
    return map[key] ?? DEFAULT;
  });
}

const SERVICE_AGREEMENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hoador Service Agreement</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.5; color: #111; max-width: 700px; margin: 0 auto; padding: 24px; }
    .logo { max-height: 40px; margin: 0 auto 16px; display: block; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    h2 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; }
    p { margin: 0 0 10px; }
    .parties { margin-bottom: 16px; }
    .section { margin-bottom: 16px; }
    @media print {
      body { padding: 16px; }
      .section { page-break-inside: avoid; }
    }
    .logo-container { text-align: center; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="logo-container">
    {{LOGO_IMG}}
  </div>
  <h1>Hoador Service Agreement</h1>

  <div class="parties">
    <p><strong>Provider:</strong> {{PROVIDER_NAME}}</p>
    <p><strong>Requester (Client):</strong> {{REQUESTER_NAME}}</p>
  </div>

  <h2>1. Service and Schedule</h2>
  <div class="section">
    <p>This agreement is between the Provider ({{PROVIDER_NAME}}) and the Requester ({{REQUESTER_NAME}}) for the following service:</p>
    <p><strong>Service description:</strong> {{SERVICE_DESCRIPTION}}</p>
    <p><strong>Scheduled date and time:</strong> {{SCHEDULED_DATE_TIME}}</p>
    <p><strong>Duration / scope:</strong> {{DURATION_OR_SCOPE}}</p>
    <p><strong>Total amount:</strong> {{TOTAL_AMOUNT}}</p>
  </div>

  <h2>2. Performance and Cooperation</h2>
  <div class="section">
    <p>The Provider agrees to perform the agreed service in a professional manner. The Requester agrees to provide reasonable access, information, and cooperation needed for the Provider to complete the work.</p>
  </div>

  <h2>3. Payments and Cancellations</h2>
  <div class="section">
    <p>Payment for this booking is processed through the Hoador platform. Cancellations, refunds, and disputes are governed by the platform's Cancellation &amp; Refund Policy, Payment &amp; Payout Policy, and related terms.</p>
  </div>

  <h2>4. Safety and Liability</h2>
  <div class="section">
    <p>Both parties acknowledge the platform's Safety &amp; Liability disclosures. The Requester assumes risks associated with the service environment where applicable. Neither party limits liability for matters that cannot be limited under applicable law.</p>
  </div>

  <h2>5. Platform Terms</h2>
  <div class="section">
    <p>This agreement is subject to the Hoador Terms of Service and other platform policies incorporated by reference.</p>
  </div>

  <h2>6. Electronic Acceptance</h2>
  <div class="section">
    <p>By requesting and accepting this booking through the Hoador platform, the parties agree to the terms set forth herein. This document may be executed and delivered electronically.</p>
  </div>

  <h2>7. Governing Law</h2>
  <div class="section">
    <p>This agreement shall be governed by the laws of the United States and the state in which the Provider is located, without regard to conflict of law principles.</p>
  </div>

  <p style="margin-top: 24px;"><em>Generated by Hoador. This document was generated from the Hoador Service Agreement template.</em></p>
</body>
</html>`;

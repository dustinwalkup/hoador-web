/**
 * Template and version for the Hoador Tool and Service Rental Agreement.
 * Used for per-rental PDF generation with placeholders filled from rental/listing/user data.
 */

export const RENTAL_AGREEMENT_TEMPLATE_VERSION = "1.0";

/**
 * Data required to fill the rental agreement template.
 * All string fields use "N/A" when missing (optional fields).
 */
export interface RentalAgreementData {
  providerName: string;
  renterName: string;
  listingDescription: string;
  startDate: string;
  endDate: string;
  rentalLocation: string;
  totalRentalAmount: string;
}

const DEFAULT = "N/A";

/**
 * Replaces placeholder keys in the template with values from data.
 * Missing or empty optional values are replaced with "N/A".
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface RenderTemplateOptions {
  /** Base64 data URL for the logo image (e.g. data:image/png;base64,...). */
  logoDataUrl?: string;
}

/**
 * Renders the rental agreement HTML template with the given data.
 * Placeholders: {{PROVIDER_NAME}}, {{RENTER_NAME}}, {{LISTING_DESCRIPTION}},
 * {{START_DATE}}, {{END_DATE}}, {{RENTAL_LOCATION}}, {{TOTAL_COST}}, {{LOGO_IMG}}.
 * Uses "N/A" for missing or empty optional fields.
 *
 * @param data - Rental agreement data (provider, renter, listing, dates, location, cost).
 * @param options - Optional logo data URL for branding.
 * @returns HTML string ready for PDF generation.
 */
export function renderTemplate(
  data: RentalAgreementData,
  options?: RenderTemplateOptions,
): string {
  const providerName = data.providerName?.trim() || DEFAULT;
  const renterName = data.renterName?.trim() || DEFAULT;
  const listingDescription = data.listingDescription?.trim() || DEFAULT;
  const startDate = data.startDate?.trim() || DEFAULT;
  const endDate = data.endDate?.trim() || DEFAULT;
  const rentalLocation = data.rentalLocation?.trim() || DEFAULT;
  const totalRentalAmount = data.totalRentalAmount?.trim() || DEFAULT;

  const logoImg = options?.logoDataUrl
    ? `<img src="${options.logoDataUrl}" alt="Hoador" class="logo" />`
    : "";

  return RENTAL_AGREEMENT_HTML.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const map: Record<string, string> = {
      PROVIDER_NAME: escapeHtml(providerName),
      RENTER_NAME: escapeHtml(renterName),
      LISTING_DESCRIPTION: escapeHtml(listingDescription),
      START_DATE: escapeHtml(startDate),
      END_DATE: escapeHtml(endDate),
      RENTAL_LOCATION: escapeHtml(rentalLocation),
      TOTAL_RENTAL_AMOUNT: escapeHtml(totalRentalAmount),
      LOGO_IMG: logoImg,
    };
    return map[key] ?? DEFAULT;
  });
}

/** Placeholder-based HTML for the Hoador Tool and Service Rental Agreement. */
const RENTAL_AGREEMENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hoador Tool and Service Rental Agreement</title>
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
  <h1>Hoador Rental Agreement</h1>

  <div class="parties">
    <p><strong>Provider (Owner):</strong> {{PROVIDER_NAME}}</p>
    <p><strong>Renter:</strong> {{RENTER_NAME}}</p>
  </div>

  <h2>1. Parties and Transaction Details</h2>
  <div class="section">
    <p>This agreement is entered into between the Provider ({{PROVIDER_NAME}}) and the Renter ({{RENTER_NAME}}). The Renter agrees to rent the following tool or service from the Provider:</p>
    <p><strong>Listing Description:</strong> {{LISTING_DESCRIPTION}}</p>
    <p><strong>Start Date:</strong> {{START_DATE}}</p>
    <p><strong>End Date:</strong> {{END_DATE}}</p>
    <p><strong>Rental Location:</strong> {{RENTAL_LOCATION}}</p>
    <p><strong>Total Rental Amount:</strong> {{TOTAL_RENTAL_AMOUNT}}</p>
  </div>

  <h2>2. Condition and Inspection</h2>
  <div class="section">
    <p>The Renter acknowledges receiving the tool or service in the condition documented at the time of handoff. The Renter shall inspect the item before use and report any defects to the Provider promptly. Failure to report defects may affect the Renter's liability.</p>
  </div>

  <h2>3. Use and Responsibility</h2>
  <div class="section">
    <p>The Renter agrees to use the tool or service only for its intended purpose and in accordance with any instructions provided by the Provider. The Renter is responsible for proper use and shall be liable for damage or loss resulting from misuse, negligence, or failure to follow instructions.</p>
  </div>

  <h2>4. Return of Tools</h2>
  <div class="section">
    <p>The Renter shall return the tool or complete the service arrangement by the end date specified above ({{END_DATE}}) unless otherwise agreed in writing. The item shall be returned in the same condition as received, subject to normal wear. Late returns may incur additional fees as specified by the Provider or platform policies.</p>
  </div>

  <h2>5. Service Performance</h2>
  <div class="section">
    <p>Where the rental includes setup or service performance by the Provider, the Provider agrees to perform such services in a workmanlike manner. The Renter shall provide access and cooperation as reasonably required for the Provider to fulfill the agreement.</p>
  </div>

  <h2>6. Deposits, Payments, and Refunds</h2>
  <div class="section">
    <p>Total rental amount for this rental is {{TOTAL_RENTAL_AMOUNT}}. Payment and any security deposit are governed by the platform's payment terms. Refunds and cancellations are subject to the Cancellations and Disputes section and the platform's policies.</p>
  </div>

  <h2>7. Cancellations and Disputes</h2>
  <div class="section">
    <p>Cancellations must be communicated through the platform. Disputes arising from this agreement should first be resolved between the parties; unresolved disputes may be escalated through the platform's dispute resolution process. Governing law applies as set forth below.</p>
  </div>

  <h2>8. Liability and Assumption of Risk</h2>
  <div class="section">
    <p>The Renter assumes all risks associated with the use of the rented tool or service. To the extent permitted by law, the Provider and Hoador Inc. disclaim liability for injury, loss, or damage arising from the Renter's use. The Renter is encouraged to maintain appropriate insurance.</p>
  </div>

  <h2>9. Ownership and Title</h2>
  <div class="section">
    <p>Title and ownership of the rented tool or service remain with the Provider. No transfer of ownership is implied. The Renter has no right to sell, sublease, or encumber the item.</p>
  </div>

  <h2>10. Electronic Acceptance</h2>
  <div class="section">
    <p>By submitting a rental request and confirming acceptance of this agreement through the Hoador platform, the Renter agrees to the terms set forth herein. This document may be executed and delivered electronically and shall have the same effect as a signed original.</p>
  </div>

  <h2>11. Governing Law</h2>
  <div class="section">
    <p>This agreement shall be governed by the laws of the United States and the state in which the Provider is located, without regard to conflict of law principles. Any legal action shall be brought in the courts of that jurisdiction.</p>
  </div>

  <p style="margin-top: 24px;"><em>Generated by Hoador. This document was generated from the Hoador Tool and Service Rental Agreement template.</em></p>
</body>
</html>`;

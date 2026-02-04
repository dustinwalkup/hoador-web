/**
 * Playwright-based rental agreement PDF generation.
 * Uses Chromium to render HTML template to PDF buffer.
 */

export {
  RENTAL_AGREEMENT_TEMPLATE_VERSION,
  renderTemplate,
  type RentalAgreementData,
} from "./template";
export {
  generateRentalAgreementPdf,
  generateAndStoreRentalAgreement,
  getPayloadForRentalAgreement,
} from "./utils";

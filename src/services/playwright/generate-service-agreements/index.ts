/**
 * Playwright-based service agreement PDF generation.
 */

export {
  SERVICE_AGREEMENT_TEMPLATE_VERSION,
  renderServiceAgreementTemplate,
  type ServiceAgreementData,
} from "./template";
export {
  generateServiceAgreementPdf,
  generateAndStoreServiceAgreement,
  getPayloadForServiceAgreement,
} from "./utils";

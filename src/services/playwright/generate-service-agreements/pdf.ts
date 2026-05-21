/**
 * PDF generation for service agreements using puppeteer-core + @sparticuz/chromium.
 * Compatible with both Vercel serverless and local development.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { launchBrowser } from "../launch-browser";

import type { ServiceAgreementData } from "./template";
import { renderServiceAgreementTemplate } from "./template";

const LOGO_PATH = join(process.cwd(), "public", "hoador-logo.png");

function loadLogoDataUrl(): string | undefined {
  if (!existsSync(LOGO_PATH)) return undefined;
  try {
    const buffer = readFileSync(LOGO_PATH);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Generates a service agreement PDF using Puppeteer with a serverless-compatible Chromium binary.
 *
 * @param data - Service agreement payload.
 * @returns PDF buffer suitable for upload to blob storage.
 */
export async function generateServiceAgreementPdf(
  data: ServiceAgreementData,
): Promise<Buffer> {
  const logoDataUrl = loadLogoDataUrl();
  const html = renderServiceAgreementTemplate(data, { logoDataUrl });
  let browser;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "load",
      timeout: 10_000,
    });

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    return Buffer.from(buffer);
  } catch (error) {
    console.error("Service agreement PDF generation failed:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch((err: unknown) => {
        console.warn("Error closing browser:", err);
      });
    }
  }
}

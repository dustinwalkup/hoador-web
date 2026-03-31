#!/usr/bin/env npx tsx
/**
 * Generate service agreement PDFs for legal review or admin upload.
 *
 * - Generic: Hoador HTML template with all placeholders "N/A" (no DB). Use as a
 *   starting point; have counsel replace body text and export final PDF for upload.
 * - Filled: real data from an existing service booking (requires DATABASE_URL).
 *
 * Usage:
 *   bun run generate:service-agreement -- --generic [--output path] [--open]
 *   bun run generate:service-agreement -- --service-booking-id <uuid> [--output path] [--open]
 */

import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { generateServiceAgreementPdf } from "@/services/playwright/generate-service-agreements/pdf";
import type { ServiceAgreementData } from "@/services/playwright/generate-service-agreements/template";

const DEFAULT_OUTPUT_DIR = join(process.cwd(), "output");
const DEFAULT_GENERIC_FILENAME = "service-agreement-generic.pdf";
const DEFAULT_FILLED_FILENAME = "service-agreement-filled.pdf";

const GENERIC_PLACEHOLDER_DATA: ServiceAgreementData = {
  providerName: "N/A",
  requesterName: "N/A",
  serviceDescription: "N/A",
  scheduledDateTime: "N/A",
  durationOrScope: "N/A",
  totalAmount: "N/A",
};

function parseArgs(): {
  mode: "generic" | "filled";
  serviceBookingId?: string;
  outputPath: string;
  open: boolean;
} {
  const args = process.argv.slice(2);
  let mode: "generic" | "filled" | null = null;
  let serviceBookingId: string | undefined;
  let outputPath = "";
  let open = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--generic":
        mode = "generic";
        break;
      case "--service-booking-id":
        mode = "filled";
        serviceBookingId = args[++i];
        if (!serviceBookingId?.match(/^[0-9a-f-]{36}$/i)) {
          console.error("Invalid or missing service booking ID (must be UUID)");
          process.exit(1);
        }
        break;
      case "--output":
      case "-o":
        outputPath = args[++i];
        if (!outputPath) {
          console.error("--output requires a path");
          process.exit(1);
        }
        break;
      case "--open":
        open = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  if (!mode) {
    console.error("Specify --generic or --service-booking-id <uuid>");
    printHelp();
    process.exit(1);
  }

  if (mode === "filled" && !serviceBookingId) {
    console.error("--service-booking-id requires a UUID");
    process.exit(1);
  }

  const defaultFilename =
    mode === "generic" ? DEFAULT_GENERIC_FILENAME : DEFAULT_FILLED_FILENAME;
  const resolvedOutput = outputPath
    ? outputPath
    : join(DEFAULT_OUTPUT_DIR, defaultFilename);

  return { mode, serviceBookingId, outputPath: resolvedOutput, open };
}

function printHelp(): void {
  console.log(`
Usage:
  bun run generate:service-agreement -- --generic [options]
  bun run generate:service-agreement -- --service-booking-id <uuid> [options]

Options:
  --generic                 Generic PDF (placeholders N/A). No database.
  --service-booking-id      Filled PDF from DB booking row + joins.
  --output, -o <path>       Output path. Default: output/service-agreement-*.pdf
  --open                    Open in default PDF viewer after write.
  --help, -h                This help.

Admin upload (Per-Service Agreement):
  1. Run --generic to get a PDF from the in-app template, OR draft in Word/Google Docs.
  2. Have legal review; export final content as PDF.
  3. Admin → Legal Documents → Upload: choose "Per-Service Agreement", version (e.g. 1.0), file.

Examples:
  bun run generate:service-agreement -- --generic
  bun run generate:service-agreement -- --generic --open
  bun run generate:service-agreement -- --service-booking-id <uuid> -o ./sample.pdf

Prerequisites:
  - Playwright: npx playwright install chromium
  - For --service-booking-id: DATABASE_URL in .env
`);
}

async function ensureOutputDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function openPdf(path: string): void {
  const os = process.platform;
  const command =
    os === "darwin"
      ? `open "${path}"`
      : os === "win32"
        ? `start "" "${path}"`
        : `xdg-open "${path}"`;
  try {
    execSync(command);
    console.log("Opened PDF in default viewer.");
  } catch (err) {
    console.warn("Could not open PDF automatically:", err);
    console.log(`Saved to: ${path}`);
  }
}

async function main(): Promise<void> {
  const { mode, serviceBookingId, outputPath, open } = parseArgs();

  await ensureOutputDir(outputPath);

  let data: ServiceAgreementData;

  if (mode === "generic") {
    console.log("Generating generic service agreement PDF...");
    data = GENERIC_PLACEHOLDER_DATA;
  } else {
    console.log(
      `Generating filled service agreement PDF for booking ${serviceBookingId}...`,
    );
    const { getPayloadForServiceAgreement } =
      await import("@/services/playwright/generate-service-agreements/get-payload");
    const payload = await getPayloadForServiceAgreement(serviceBookingId!);
    if (!payload) {
      console.error(
        "Service booking not found. Check the UUID and DATABASE_URL.",
      );
      process.exit(1);
    }
    data = payload;
  }

  const buffer = await generateServiceAgreementPdf(data);
  writeFileSync(outputPath, buffer);

  console.log(`✓ PDF saved to: ${outputPath}`);

  if (open) {
    openPdf(outputPath);
  }
}

main().catch((err) => {
  console.error("Error generating PDF:", err);
  process.exit(1);
});

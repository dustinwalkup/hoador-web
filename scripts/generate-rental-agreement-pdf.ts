#!/usr/bin/env npx tsx
/**
 * Script to generate rental agreement PDFs.
 * Supports:
 * 1. Filled PDF – uses real rental data from a rental request ID
 * 2. Generic PDF – fallback version with "N/A" for all placeholders
 *
 * Usage:
 *   bun run scripts/generate-rental-agreement-pdf.ts --generic [--output path] [--open]
 *   bun run scripts/generate-rental-agreement-pdf.ts --rental-request-id <uuid> [--output path] [--open]
 */

import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { generateRentalAgreementPdf } from "@/services/playwright/generate-rental-agreements/pdf";
import type { RentalAgreementData } from "@/services/playwright/generate-rental-agreements/template";

const DEFAULT_OUTPUT_DIR = join(process.cwd(), "output");
const DEFAULT_GENERIC_FILENAME = "rental-agreement-generic.pdf";
const DEFAULT_FILLED_FILENAME = "rental-agreement-filled.pdf";

/** Placeholder data for the generic/fallback version. */
const GENERIC_PLACEHOLDER_DATA: RentalAgreementData = {
  providerName: "N/A",
  renterName: "N/A",
  listingDescription: "N/A",
  startDate: "N/A",
  endDate: "N/A",
  rentalLocation: "N/A",
  totalRentalAmount: "N/A",
};

function parseArgs(): {
  mode: "generic" | "filled";
  rentalRequestId?: string;
  outputPath: string;
  open: boolean;
} {
  const args = process.argv.slice(2);
  let mode: "generic" | "filled" | null = null;
  let rentalRequestId: string | undefined;
  let outputPath = "";
  let open = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--generic":
        mode = "generic";
        break;
      case "--rental-request-id":
        mode = "filled";
        rentalRequestId = args[++i];
        if (!rentalRequestId?.match(/^[0-9a-f-]{36}$/i)) {
          console.error("Invalid or missing rental request ID (must be UUID)");
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
    console.error("Specify --generic or --rental-request-id <uuid>");
    printHelp();
    process.exit(1);
  }

  if (mode === "filled" && !rentalRequestId) {
    console.error("--rental-request-id requires a UUID");
    process.exit(1);
  }

  const defaultFilename =
    mode === "generic" ? DEFAULT_GENERIC_FILENAME : DEFAULT_FILLED_FILENAME;
  const resolvedOutput = outputPath
    ? outputPath
    : join(DEFAULT_OUTPUT_DIR, defaultFilename);

  return { mode, rentalRequestId, outputPath: resolvedOutput, open };
}

function printHelp(): void {
  console.log(`
Usage:
  bun run scripts/generate-rental-agreement-pdf.ts --generic [options]
  bun run scripts/generate-rental-agreement-pdf.ts --rental-request-id <uuid> [options]

Options:
  --generic              Generate the generic/fallback PDF (all placeholders = "N/A").
                         No database connection required.
  --rental-request-id    Generate a filled PDF using real rental data.
                         Requires database (e.g. DATABASE_URL in .env).
  --output, -o <path>    Output file path. Default: output/rental-agreement-*.pdf
  --open                 Open the generated PDF in the default viewer (for printing).
  --help, -h             Show this help.

Examples:
  bun run scripts/generate-rental-agreement-pdf.ts --generic
  bun run scripts/generate-rental-agreement-pdf.ts --generic --open
  bun run scripts/generate-rental-agreement-pdf.ts --rental-request-id abc123-... --output ./my-agreement.pdf

Prerequisites:
  - Playwright browsers: npx playwright install
  - For --rental-request-id: DATABASE_URL in .env
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
  const { mode, rentalRequestId, outputPath, open } = parseArgs();

  await ensureOutputDir(outputPath);

  let data: RentalAgreementData;

  if (mode === "generic") {
    console.log(
      "Generating generic rental agreement PDF (fallback version)...",
    );
    data = GENERIC_PLACEHOLDER_DATA;
  } else {
    console.log(
      `Generating filled rental agreement PDF for request ${rentalRequestId}...`,
    );
    const { getPayloadForRentalAgreement } =
      await import("@/services/playwright/generate-rental-agreements/get-payload");
    const payload = await getPayloadForRentalAgreement(rentalRequestId!);
    if (!payload) {
      console.error(
        "Rental request not found or missing data. Ensure the request exists and is approved.",
      );
      process.exit(1);
    }
    data = payload;
  }

  const buffer = await generateRentalAgreementPdf(data);
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

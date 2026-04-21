/**
 * Shared browser launcher for PDF generation.
 * Uses @sparticuz/chromium in serverless (Vercel/Lambda) and falls back
 * to a locally-installed Chrome/Chromium for local development.
 */

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

const LOCAL_CHROME_PATHS = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

async function getExecutablePath(): Promise<string> {
  // In serverless, @sparticuz/chromium provides the binary
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return chromium.executablePath();
  }

  // Locally, find an installed browser
  const { existsSync } = await import("fs");
  for (const p of LOCAL_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }

  // Last resort: try the serverless binary anyway
  return chromium.executablePath();
}

export async function launchBrowser(): Promise<Browser> {
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  return puppeteer.launch({
    args: isServerless
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await getExecutablePath(),
    headless: true,
  });
}

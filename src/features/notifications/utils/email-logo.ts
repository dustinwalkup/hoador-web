import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Content-ID used in email HTML for the inline logo (e.g. src="cid:hoador-logo"). */
export const EMAIL_LOGO_CID = "hoador-logo";

/**
 * HTML snippet for the Hoador logo in email bodies. Use with CID attachment so the logo
 * displays without relying on an external URL.
 */
export const EMAIL_LOGO_HTML = `<div style="text-align: center; margin-bottom: 30px;">
  <img src="cid:${EMAIL_LOGO_CID}" alt="Hoador" style="height: 50px;">
</div>`;

export interface EmailLogoAttachment {
  filename: string;
  content: string;
  contentId: string;
  contentType?: string;
}

const LOGO_PATH = join(process.cwd(), "public", "hoador-logo.png");

/**
 * Returns a Resend attachment for the Hoador logo (PNG) for inline use in emails.
 * Use with EMAIL_LOGO_HTML in the email body. Returns null if the file is missing.
 */
export function getEmailLogoAttachment(): EmailLogoAttachment | null {
  if (!existsSync(LOGO_PATH)) return null;
  try {
    const buffer = readFileSync(LOGO_PATH);
    const content = buffer.toString("base64");
    return {
      filename: "hoador-logo.png",
      content,
      contentId: EMAIL_LOGO_CID,
      contentType: "image/png",
    };
  } catch {
    return null;
  }
}

import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required");
}

// Hoador green
export const PRIMARY_COLOR = "#4c9443";

export const resend = new Resend(process.env.RESEND_API_KEY);

// Constants for resend
export const RESEND_FROM_EMAIL = "Hoador <noreply@hoador.com>";

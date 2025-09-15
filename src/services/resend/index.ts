import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Constants for resend
export const RESEND_FROM_EMAIL = "Hoador <noreply@resend.dev>";

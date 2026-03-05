import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  handleApiError,
  captureNonCriticalError,
} from "@/lib/api/route-helpers";
import { sendEmail } from "@/features/notifications/utils/send-email";
import { hoaInquirySchema } from "@/features/hoa-inquiries/schema/hoa-inquiry.schema";
import { formatPhoneNumber } from "@/lib/utils";

const NOTIFY_EMAIL =
  process.env.HOA_INQUIRY_NOTIFY_EMAIL ?? "dustin@hoador.com";

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const result = hoaInquirySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const data = result.data;
    const formattedPhone = data.phone ? formatPhoneNumber(data.phone) : "";
    const formattedHoaContactPhone = data.hoaContactPhone
      ? formatPhoneNumber(data.hoaContactPhone)
      : "";

    // Write to Google Sheets
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_SHEETS_CLIENT_ID,
      process.env.GOOGLE_SHEETS_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_SHEETS_REFRESH_TOKEN,
    });

    const sheets = google.sheets({
      version: "v4",
      auth: oauth2Client,
    });

    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: "Sheet1!A:J",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            timestamp,
            data.hoaName,
            data.city,
            data.state,
            data.name,
            data.email,
            formattedPhone,
            data.hoaContactName ?? "",
            data.hoaContactEmail ?? "",
            formattedHoaContactPhone,
          ],
        ],
      },
    });

    // Send team notification email (fire-and-forget)
    try {
      await sendEmail({
        to: NOTIFY_EMAIL,
        subject: `New HOA Inquiry: ${data.hoaName} (${data.city}, ${data.state})`,
        html: `
          <h2>New HOA Community Request</h2>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">HOA Name</td><td>${data.hoaName}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Location</td><td>${data.city}, ${data.state}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Submitted By</td><td>${data.name} (${data.email})</td></tr>
            ${formattedPhone ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Phone</td><td>${formattedPhone}</td></tr>` : ""}
            ${data.hoaContactName ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">HOA Contact</td><td>${data.hoaContactName}</td></tr>` : ""}
            ${data.hoaContactEmail ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">HOA Contact Email</td><td>${data.hoaContactEmail}</td></tr>` : ""}
            ${formattedHoaContactPhone ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">HOA Contact Phone</td><td>${formattedHoaContactPhone}</td></tr>` : ""}
          </table>
          <p style="color:#666;font-size:12px;margin-top:16px;">Submitted at ${timestamp}</p>
        `,
        text: `New HOA Community Request\n\nHOA: ${data.hoaName}\nLocation: ${data.city}, ${data.state}\nFrom: ${data.name} (${data.email})\n${formattedPhone ? `Phone: ${formattedPhone}\n` : ""}${data.hoaContactName ? `HOA Contact: ${data.hoaContactName}\n` : ""}${data.hoaContactEmail ? `HOA Contact Email: ${data.hoaContactEmail}\n` : ""}${formattedHoaContactPhone ? `HOA Contact Phone: ${formattedHoaContactPhone}\n` : ""}`,
      });
    } catch (emailError) {
      captureNonCriticalError(emailError, {
        route: "POST /api/hoa-inquiries",
        action: "send_team_notification",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(postHandler, "POST /api/hoa-inquiries");

import { resend, RESEND_FROM_EMAIL } from ".";

/**
 * Send email verification email
 */
export async function sendVerificationEmail({
  to,
  verificationUrl,
  firstName,
}: {
  to: string;
  verificationUrl: string;
  firstName?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "Verify your Hoador account",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your Hoador account</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">
              Welcome to Hoador${firstName ? `, ${firstName}` : ""}!
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thanks for joining your neighborhood tool sharing community. To get started, please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #2563eb; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>This verification link will expire in 24 hours.</p>
              <p>If you didn't create a Hoador account, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to Hoador${firstName ? `, ${firstName}` : ""}!

Thanks for joining your neighborhood tool sharing community. To get started, please verify your email address by visiting:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create a Hoador account, you can safely ignore this email.
      `.trim(),
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      throw new Error("Failed to send verification email");
    }

    console.log("Verification email sent successfully:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

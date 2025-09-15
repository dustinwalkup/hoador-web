import { resend, RESEND_FROM_EMAIL } from ".";

/**
 * Send reset password email
 */
export async function sendResetPasswordEmail({
  to,
  callbackUrl,
}: {
  to: string;
  callbackUrl: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "Reset your Hoador password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset your Hoador password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">
              Hello, reset your Hoador password!
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              To reset your Hoador password, please click the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${callbackUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #2563eb; word-break: break-all;">
              ${callbackUrl}
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>This reset password link will expire in 15 minutes.</p>
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send reset password email:", error);
      throw new Error("Failed to send reset password email");
    }

    console.log("Reset password email sent successfully:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending verification email reset password:", error);
    throw new Error("Failed to send reset password email");
  }
}

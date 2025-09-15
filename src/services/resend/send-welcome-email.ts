import { resend, RESEND_FROM_EMAIL } from ".";

/**
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail({
  to,
  firstName,
  communityName,
}: {
  to: string;
  firstName?: string;
  communityName?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: "Welcome to Hoador! 🎉",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Hoador!</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">
              🎉 Welcome to Hoador${firstName ? `, ${firstName}` : ""}!
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your email has been verified and you're now part of ${communityName || "your neighborhood"} tool sharing community!
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Next steps:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Complete your profile setup</li>
                <li>Add your first tool to share</li>
                <li>Browse tools available in your community</li>
                <li>Connect with your neighbors</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>Happy tool sharing!</p>
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      throw new Error("Failed to send welcome email");
    }

    console.log("Welcome email sent successfully:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw error;
  }
}

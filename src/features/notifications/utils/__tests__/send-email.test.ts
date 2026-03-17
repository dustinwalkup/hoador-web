import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEmailLogoAttachment } from "@/features/notifications/utils/email-logo";
import { sendEmail } from "../send-email";
import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

// Mock the email logo helper so tests don't depend on filesystem
vi.mock("@/features/notifications/utils/email-logo", () => ({
  getEmailLogoAttachment: vi.fn().mockReturnValue(null),
  EMAIL_LOGO_HTML: "<div>Logo</div>",
  EMAIL_LOGO_CID: "hoador-logo",
}));

// Mock the resend service
vi.mock("@/services/resend", () => ({
  resend: {
    emails: {
      send: vi.fn(),
    },
  },
  RESEND_FROM_EMAIL: "test@example.com",
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should send email successfully", async () => {
    // Arrange
    const mockEmailData = {
      id: "email-123",
    };

    vi.mocked(resend.emails.send).mockResolvedValue({
      data: mockEmailData,
      error: null,
      headers: null,
    } as any);

    const emailOptions = {
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
    };

    // Act
    const result = await sendEmail(emailOptions);

    // Assert
    expect(result).toEqual({ success: true });
    expect(resend.emails.send).toHaveBeenCalledWith({
      from: RESEND_FROM_EMAIL,
      to: [emailOptions.to],
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text,
    });
    expect(console.log).toHaveBeenCalledWith(
      "Email sent successfully:",
      mockEmailData.id,
    );
  });

  it("should return error when Resend API returns error", async () => {
    // Arrange
    const mockError = {
      message: "Invalid email address",
    };

    vi.mocked(resend.emails.send).mockResolvedValue({
      data: null,
      error: mockError,
      headers: null,
    } as any);

    const emailOptions = {
      to: "invalid-email",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
    };

    // Act
    const result = await sendEmail(emailOptions);

    // Assert
    expect(result).toEqual({
      success: false,
      error: mockError.message,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Failed to send email:",
      mockError,
    );
  });

  it("should handle exceptions gracefully", async () => {
    // Arrange
    const mockError = new Error("Network error");

    vi.mocked(resend.emails.send).mockRejectedValue(mockError);

    const emailOptions = {
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
    };

    // Act
    const result = await sendEmail(emailOptions);

    // Assert
    expect(result).toEqual({
      success: false,
      error: mockError.message,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error sending email:",
      mockError,
    );
  });

  it("should handle non-Error exceptions", async () => {
    // Arrange
    const mockError = "String error";

    vi.mocked(resend.emails.send).mockRejectedValue(mockError);

    const emailOptions = {
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Test HTML</p>",
      text: "Test Text",
    };

    // Act
    const result = await sendEmail(emailOptions);

    // Assert
    expect(result).toEqual({
      success: false,
      error: "Unknown error",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error sending email:",
      mockError,
    );
  });

  it("should pass email parameters correctly", async () => {
    // Arrange
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: { id: "email-123" },
      error: null,
      headers: null,
    } as any);

    const emailOptions = {
      to: "test@example.com",
      subject: "Test Email Subject",
      html: "<h1>HTML Content</h1>",
      text: "Plain text content",
    };

    // Act
    await sendEmail(emailOptions);

    // Assert
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
    expect(resend.emails.send).toHaveBeenCalledWith({
      from: RESEND_FROM_EMAIL,
      to: [emailOptions.to],
      subject: emailOptions.subject,
      html: emailOptions.html,
      text: emailOptions.text,
    });
  });

  it("should include logo attachment when getEmailLogoAttachment returns attachment", async () => {
    const logoAttachment = {
      filename: "hoador-logo.png",
      content: "base64content",
      contentId: "hoador-logo",
    };
    vi.mocked(getEmailLogoAttachment).mockReturnValue(logoAttachment);
    vi.mocked(resend.emails.send).mockResolvedValue({
      data: { id: "email-456" },
      error: null,
      headers: null,
    } as any);

    const emailOptions = {
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    };

    await sendEmail(emailOptions);

    expect(resend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: RESEND_FROM_EMAIL,
        to: [emailOptions.to],
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text,
        attachments: [
          {
            filename: logoAttachment.filename,
            content: logoAttachment.content,
            contentId: logoAttachment.contentId,
          },
        ],
      }),
    );
  });
});

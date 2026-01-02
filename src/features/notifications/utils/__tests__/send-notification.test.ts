import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNotification } from "../send-notification";
import { notificationsDAL } from "@/dal";
import { sendEmail } from "../send-email";

// Mock dependencies
vi.mock("@walkup/walkup-utils", async () => {
  const actual = await vi.importActual("@walkup/walkup-utils");
  return {
    ...actual,
    tryCatch: vi.fn((promise) => {
      return Promise.resolve(promise).then(
        (data) => ({ data, error: null }),
        (error) => ({ data: null, error }),
      );
    }),
  };
});

vi.mock("@/dal", () => ({
  notificationsDAL: {
    create: vi.fn(),
  },
}));

vi.mock("../send-email", () => ({
  sendEmail: vi.fn(),
}));

describe("sendNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should create notification and send email successfully", async () => {
    // Arrange
    const mockNotification = {
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    vi.mocked(notificationsDAL.create).mockResolvedValue(mockNotification);
    vi.mocked(sendEmail).mockResolvedValue({ success: true });

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: { rentalId: "rental-123" },
      email: {
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test Text",
      },
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result).toEqual({
      success: true,
      notificationId: mockNotification.id,
      emailSent: true,
      smsSent: false,
    });
    expect(notificationsDAL.create).toHaveBeenCalledWith({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      data: options.data,
    });
    expect(sendEmail).toHaveBeenCalledWith(options.email);
  });

  it("should create notification without email", async () => {
    // Arrange
    const mockNotification = {
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    vi.mocked(notificationsDAL.create).mockResolvedValue(mockNotification);

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result).toEqual({
      success: true,
      notificationId: mockNotification.id,
      emailSent: false,
      smsSent: false,
    });
    expect(notificationsDAL.create).toHaveBeenCalledWith({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      data: {},
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should add linkUrl to notification data when provided", async () => {
    // Arrange
    const mockNotification = {
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    vi.mocked(notificationsDAL.create).mockResolvedValue(mockNotification);

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: { rentalId: "rental-123" },
      linkUrl: "/dashboard/rentals/rental-123",
    };

    // Act
    await sendNotification(options);

    // Assert
    expect(notificationsDAL.create).toHaveBeenCalledWith({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      data: {
        ...options.data,
        linkUrl: options.linkUrl,
      },
    });
  });

  it("should return error when notification creation fails", async () => {
    // Arrange
    const mockError = new Error("Failed to create notification");

    vi.mocked(notificationsDAL.create).mockRejectedValue(mockError);

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result).toEqual({
      success: false,
      error: mockError.message,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Failed to create notification:",
      expect.anything(),
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should handle email failure gracefully (notification still created)", async () => {
    // Arrange
    const mockNotification = {
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    vi.mocked(notificationsDAL.create).mockResolvedValue(mockNotification);
    vi.mocked(sendEmail).mockResolvedValue({
      success: false,
      error: "Email service unavailable",
    });

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      email: {
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test Text",
      },
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result).toEqual({
      success: true,
      notificationId: mockNotification.id,
      emailSent: false,
      smsSent: false,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Email failed but notification was created:",
      "Email service unavailable",
    );
  });

  it("should log SMS option but not implement it", async () => {
    // Arrange
    const mockNotification = {
      id: "notification-123",
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      data: {},
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };

    vi.mocked(notificationsDAL.create).mockResolvedValue(mockNotification);

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
      sms: {
        to: "+1234567890",
        body: "Test SMS",
      },
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result).toEqual({
      success: true,
      notificationId: mockNotification.id,
      emailSent: false,
      smsSent: false,
    });
    expect(console.log).toHaveBeenCalledWith(
      "SMS sending not yet implemented. Message would be sent to:",
      options.sms.to,
    );
  });

  it("should handle notification creation error with tryCatch wrapper", async () => {
    // Arrange
    // When notificationsDAL.create throws, tryCatch will catch it
    // and return { data: null, error: error }
    const mockError = new Error("Database error");

    // Mock the tryCatch behavior - it wraps the error
    vi.mocked(notificationsDAL.create).mockImplementation(async () => {
      throw mockError;
    });

    const options = {
      userId: "user-123",
      type: "rental_request_created" as const,
      title: "Test Title",
      message: "Test Message",
    };

    // Act
    const result = await sendNotification(options);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

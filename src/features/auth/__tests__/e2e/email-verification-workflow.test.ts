import { describe, it, expect, vi, beforeEach } from "vitest";
import { resendVerificationEmailAction } from "../../actions/verify-email";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      sendVerificationEmail: vi.fn(),
    },
  },
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";

describe("Email Verification Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete email verification workflow", async () => {
    // Step 1: User signs up (handled in signup workflow)
    // Step 2: User receives verification email (handled by Better Auth)

    // Step 3: User requests resend verification email
    const formData = new FormData();
    formData.append("email", "test@example.com");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    const result = await resendVerificationEmailAction(null, formData);

    // Step 4: Verify email verification status
    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "Verification email sent! Please check your inbox.",
    );

    // Step 5: User verifies email (handled by Better Auth)
    // Step 6: User can access protected routes (verified status checked by middleware)
  });

  it("should handle already verified email", async () => {
    // Step 1: User attempts to resend verification for already verified email
    const formData = new FormData();
    formData.append("email", "verified@example.com");

    const mockError = {
      message: "Email already verified",
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: mockError,
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Step 2: Verify appropriate error is returned
    const result = await resendVerificationEmailAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("This email address is already verified.");
    consoleErrorSpy.mockRestore();
  });
});

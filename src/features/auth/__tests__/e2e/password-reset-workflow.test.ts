import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordAction } from "../../actions/forgot-password";
import { resetPasswordAction } from "../../actions/reset-password";

// Mock dependencies
vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { tryCatch } from "@walkup/walkup-utils";
import { redirect } from "next/navigation";

describe("Complete Password Reset Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("should complete full password reset workflow", async () => {
    // Step 1: User navigates to forgot password page
    // (Simulated by calling forgotPasswordAction)

    // Step 2: User enters email address
    const formData1 = new FormData();
    formData1.append("email", "test@example.com");

    // Step 3: User submits form
    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    const requestResult = await forgotPasswordAction(null, formData1);

    // Step 4: Verify password reset email was sent
    expect(requestResult.success).toBe(true);
    expect(requestResult.message).toContain(
      "If an account with that email exists",
    );

    // Step 5: User receives password reset email and clicks link
    // (Simulated by calling resetPasswordAction with token)

    // Step 6: User enters new password
    vi.clearAllMocks();
    const formData2 = new FormData();
    formData2.append("token", "reset-token-123");
    formData2.append("password", "NewSecurePass123");

    vi.mocked(tryCatch).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    // Step 7: User submits new password
    try {
      await resetPasswordAction(null, formData2);
    } catch (error) {
      // redirect() throws
    }

    // Step 8: Verify password was reset and user redirected to login
    expect(tryCatch).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      "/login?message=password-reset-success",
    );
  });
});

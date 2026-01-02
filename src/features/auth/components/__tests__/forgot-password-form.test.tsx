import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "../forgot-password-form";

// Mock server action
vi.mock("../../actions/forgot-password", () => ({
  forgotPasswordAction: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useActionState
type ActionState = { success: boolean; error?: string; message?: string } | null;
const mockFormAction = vi.fn();
const mockUseActionState = vi.fn<() => [ActionState, typeof mockFormAction, boolean]>(
  () => [null, mockFormAction, false],
);

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: () => mockUseActionState(),
  };
});

import { forgotPasswordAction } from "../../actions/forgot-password";
import { toast } from "sonner";

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockReturnValue([null, mockFormAction, false]);
  });

  it("should render email input field", () => {
    // Arrange & Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("should render submit button", () => {
    // Arrange & Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(
      screen.getByRole("button", { name: /send reset password email/i }),
    ).toBeInTheDocument();
  });

  it("should call formAction when form is submitted", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole("button", {
      name: /send reset password email/i,
    });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockFormAction).toHaveBeenCalled();
    });
  });

  it("should show loading state during submission", () => {
    // Arrange
    mockUseActionState.mockReturnValue([null, mockFormAction, true]);

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should show success message when state.success is true", () => {
    // Arrange
    mockUseActionState.mockReturnValue([
      { success: true, message: "Email sent successfully" },
      mockFormAction,
      false,
    ]);

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText("Email sent successfully")).toBeInTheDocument();
  });

  it("should show toast error when state.error is present", async () => {
    // Arrange
    const mockState = { success: false, error: "Failed to send email" };
    mockUseActionState.mockReturnValue([mockState, mockFormAction, false]);

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error", {
        description: "Failed to send email",
      });
    });
  });

  it("should show toast success when state.success is true", async () => {
    // Arrange
    const mockState = {
      success: true,
      message: "Email sent successfully",
    };
    mockUseActionState.mockReturnValue([mockState, mockFormAction, false]);

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Email Sent", {
        description: "Email sent successfully",
      });
    });
  });

  it("should disable input during submission", () => {
    // Arrange
    mockUseActionState.mockReturnValue([null, mockFormAction, true]);

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled();
  });
});

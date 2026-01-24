import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a mock mutation object that can be modified between tests
let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

// Mock next/navigation
vi.mock("next/navigation", () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: () => mockRouter,
  };
});

// Mock the useForgotPassword hook
vi.mock("../../hooks/use-auth-mutations", () => ({
  useForgotPassword: () => mockMutationState,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "../forgot-password-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader-icon" />,
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutation state to default
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue({ success: true }),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("should render email input field", () => {
    // Arrange & Act
    renderWithQueryClient(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("should render submit button", () => {
    // Arrange & Act
    renderWithQueryClient(<ForgotPasswordForm />);

    // Assert
    expect(
      screen.getByRole("button", { name: /send reset password email/i }),
    ).toBeInTheDocument();
  });

  it("should call mutation when form is submitted", async () => {
    // Arrange
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi
      .fn()
      .mockResolvedValue({ success: true });
    renderWithQueryClient(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole("button", {
      name: /send reset password email/i,
    });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });
  });

  it("should show loading state during submission", () => {
    // Arrange
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    };

    // Act
    renderWithQueryClient(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should show success message after successful submission", async () => {
    // Arrange
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi
      .fn()
      .mockResolvedValue({ success: true });
    renderWithQueryClient(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole("button", {
      name: /send reset password email/i,
    });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /if an account with that email exists, we've sent you a password reset link/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("should not show success message when mutation returns success: false", async () => {
    // Arrange
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi
      .fn()
      .mockResolvedValue({ success: false });
    renderWithQueryClient(<ForgotPasswordForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole("button", {
      name: /send reset password email/i,
    });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.click(submitButton);

    // Assert - should stay on form, not show success
    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalled();
    });
    // The form should still be visible (not the success message)
    expect(
      screen.getByRole("button", { name: /send reset password email/i }),
    ).toBeInTheDocument();
  });

  it("should disable input during submission", () => {
    // Arrange
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    };

    // Act
    renderWithQueryClient(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled();
  });
});

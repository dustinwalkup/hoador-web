import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMutationState = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as Error | null,
};

vi.mock("../../hooks/use-auth-mutations", () => ({
  useResendVerification: () => mockMutationState,
}));

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyEmailForm } from "../verify-email-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

vi.mock("lucide-react", () => ({
  Mail: () => <span data-testid="mail-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

describe("VerifyEmailForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    };
  });

  it("renders resend confirmation email button", () => {
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(
      screen.getByRole("button", { name: /resend confirmation email/i }),
    ).toBeInTheDocument();
  });

  it("renders copy about checking email and resending", () => {
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(
      screen.getByText(/click the link in the email to verify your account/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/didn't receive the email\?/i)).toBeInTheDocument();
  });

  it("calls mutate with email when form is submitted", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<VerifyEmailForm email="user@test.com" />);
    await user.click(
      screen.getByRole("button", { name: /resend confirmation email/i }),
    );
    expect(mockMutationState.mutate).toHaveBeenCalledWith({
      email: "user@test.com",
    });
  });

  it("shows error alert when resendVerification.isError is true", () => {
    mockMutationState = {
      ...mockMutationState,
      isError: true,
      error: new Error("Rate limit exceeded"),
    };
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
  });

  it("shows fallback error message when error has no message", () => {
    mockMutationState = {
      ...mockMutationState,
      isError: true,
      error: new Error(""),
    };
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(
      screen.getByText("Failed to resend verification email"),
    ).toBeInTheDocument();
  });

  it("shows success alert when resendVerification.isSuccess is true", () => {
    mockMutationState = {
      ...mockMutationState,
      isSuccess: true,
    };
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(
      screen.getByText(/verification email sent! please check your inbox/i),
    ).toBeInTheDocument();
  });

  it("shows loading state and disables button when isPending", () => {
    mockMutationState = {
      ...mockMutationState,
      isPending: true,
    };
    renderWithQueryClient(<VerifyEmailForm email="test@example.com" />);
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

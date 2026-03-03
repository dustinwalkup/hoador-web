import { describe, it, expect, vi, beforeEach } from "vitest";

let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("../../hooks/use-auth-mutations", () => ({
  useResendVerification: () => mockMutationState,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyEmailNoSessionForm } from "../verify-email-no-session-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("lucide-react", () => ({
  Mail: () => <span data-testid="mail-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

describe("VerifyEmailNoSessionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("renders session message and email input", () => {
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(
      screen.getByText(
        /we couldn't find your session. enter your email to resend the verification link/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
  });

  it("renders resend verification email button", () => {
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(
      screen.getByRole("button", { name: /resend verification email/i }),
    ).toBeInTheDocument();
  });

  it("renders login link with session-expired message", () => {
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login?message=session-expired");
  });

  it("submit button is disabled when email is empty", () => {
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(
      screen.getByRole("button", { name: /resend verification email/i }),
    ).toBeDisabled();
  });

  it("calls mutateAsync with trimmed email when form is submitted", async () => {
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    await user.type(screen.getByLabelText(/email/i), "  user@test.com  ");
    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );
    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
        email: "user@test.com",
      });
    });
  });

  it("does not call mutateAsync when email is only whitespace", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    await user.type(screen.getByLabelText(/email/i), "   ");
    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );
    expect(mockMutationState.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows success message after successful submission", async () => {
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    await user.type(screen.getByLabelText(/email/i), "user@test.com");
    await user.click(
      screen.getByRole("button", { name: /resend verification email/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/verification email sent! please check your inbox/i),
      ).toBeInTheDocument();
    });
  });

  it("shows error alert when mutation.isError is true", () => {
    mockMutationState = {
      ...mockMutationState,
      isError: true,
      error: new Error("Invalid email address"),
    };
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
  });

  it("shows fallback error message when error is not Error instance", () => {
    mockMutationState = {
      ...mockMutationState,
      isError: true,
      error: "Something went wrong" as unknown as Error,
    };
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(
      screen.getByText("Failed to send verification email"),
    ).toBeInTheDocument();
  });

  it("shows loading state and disables input and button when isPending", () => {
    mockMutationState = {
      ...mockMutationState,
      isPending: true,
    };
    renderWithQueryClient(<VerifyEmailNoSessionForm />);
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

let mockSearchParams = new URLSearchParams("token=valid-token");

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

vi.mock("../../hooks/use-auth-mutations", () => ({
  useResetPassword: () => mockMutationState,
}));

vi.mock("lucide-react", () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordForm } from "../reset-password-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("token=valid-token");
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockMutationState.isPending = false;
    mockMutationState.isError = false;
    mockMutationState.error = null;
  });

  it("shows invalid link message and link to forgot-password when token is missing", () => {
    mockSearchParams = new URLSearchParams();

    renderWithQueryClient(<ResetPasswordForm />);

    expect(
      screen.getByText(/invalid reset link.*request a new password reset/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: /request a new reset link/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("renders form when token is present", () => {
    renderWithQueryClient(<ResetPasswordForm />);

    expect(
      screen.getByPlaceholderText(/enter your new password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/confirm your new password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset password/i }),
    ).toBeInTheDocument();
  });

  it("toggles password visibility when clicking the visibility button", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    const passwordInput = screen.getByPlaceholderText(
      /enter your new password/i,
    );
    const toggle = screen.getByTestId("eye-icon").closest("button");
    expect(toggle).toBeInTheDocument();

    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(toggle!);
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByTestId("eye-off-icon").closest("button")!);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows validation hints when password is entered", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    const passwordInput = screen.getByPlaceholderText(
      /enter your new password/i,
    );
    await user.type(passwordInput, "Ab1");

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
    expect(screen.getByText(/one number/i)).toBeInTheDocument();
  });

  it("shows helper text when password is empty", () => {
    renderWithQueryClient(<ResetPasswordForm />);

    expect(
      screen.getByText(
        /must be at least 8 characters with uppercase, lowercase, and number/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows mismatch message when confirm password does not match", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    await user.type(
      screen.getByPlaceholderText(/enter your new password/i),
      "ValidPass1",
    );
    await user.type(
      screen.getByPlaceholderText(/confirm your new password/i),
      "OtherPass1",
    );

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("calls mutateAsync with token and password on valid submit", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    await user.type(
      screen.getByPlaceholderText(/enter your new password/i),
      "ValidPass1",
    );
    await user.type(
      screen.getByPlaceholderText(/confirm your new password/i),
      "ValidPass1",
    );
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({
      token: "valid-token",
      password: "ValidPass1",
    });
  });

  it("does not call mutateAsync when form is invalid", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    await user.type(
      screen.getByPlaceholderText(/enter your new password/i),
      "short",
    );
    const submitButton = screen.getByRole("button", {
      name: /reset password/i,
    });
    expect(submitButton).toBeDisabled();
    expect(mockMutationState.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not call mutateAsync when form is submitted programmatically while invalid", () => {
    renderWithQueryClient(<ResetPasswordForm />);

    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    form?.requestSubmit();

    expect(mockMutationState.mutateAsync).not.toHaveBeenCalled();
  });

  it("displays mutation error when isError and error message present", () => {
    mockMutationState.isError = true;
    mockMutationState.error = new Error("Token expired");

    renderWithQueryClient(<ResetPasswordForm />);

    expect(screen.getByText("Token expired")).toBeInTheDocument();
  });

  it("shows loading state when mutation is pending", () => {
    mockMutationState.isPending = true;

    renderWithQueryClient(<ResetPasswordForm />);

    expect(screen.getByText(/resetting password\.\.\./i)).toBeInTheDocument();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resetting password/i }),
    ).toBeDisabled();
  });

  it("handles mutateAsync rejection without throwing", async () => {
    mockMutationState.mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithQueryClient(<ResetPasswordForm />);

    await user.type(
      screen.getByPlaceholderText(/enter your new password/i),
      "ValidPass1",
    );
    await user.type(
      screen.getByPlaceholderText(/confirm your new password/i),
      "ValidPass1",
    );
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalled();
    });
  });
});

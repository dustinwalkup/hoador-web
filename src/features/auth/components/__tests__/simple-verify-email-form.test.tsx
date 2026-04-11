import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a mock mutation object that can be modified between tests
let mockMutationState = {
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock the useResendVerification hook - return the mutable state object
vi.mock("../../hooks/use-auth-mutations", () => ({
  useResendVerification: () => mockMutationState,
}));

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimpleVerifyEmailForm } from "../simple-verify-email-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock lucide-react icons (spread actual to cover transitive deps)
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Mail: () => <span data-testid="mail-icon" />,
    Loader2: () => <span data-testid="loader-icon" />,
    CheckCircle: () => <span data-testid="check-circle-icon" />,
  };
});

describe("SimpleVerifyEmailForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutation state to default
    mockMutationState = {
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("should render email verification header", () => {
    // Arrange
    const email = "test@example.com";

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(email))).toBeInTheDocument();
  });

  it("should render resend email button", () => {
    // Arrange
    const email = "test@example.com";

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /resend confirmation email/i }),
    ).toBeInTheDocument();
  });

  it("should show error message when mutation.isError is true", () => {
    // Arrange
    const email = "test@example.com";
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("Failed to send verification email"),
    };

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(
      screen.getByText("Failed to send verification email"),
    ).toBeInTheDocument();
  });

  it("should show success message after successful submission", async () => {
    // Arrange
    const email = "test@example.com";
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue({});

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);
    const button = screen.getByRole("button", {
      name: /resend confirmation email/i,
    });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(/verification email sent! please check your inbox/i),
      ).toBeInTheDocument();
    });
    expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({ email });
  });

  it("should show loading state during submission", () => {
    // Arrange
    const email = "test@example.com";
    mockMutationState = {
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    };

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("should call mutation with email when form is submitted", async () => {
    // Arrange
    const email = "test@example.com";
    const user = userEvent.setup();
    mockMutationState.mutateAsync = vi.fn().mockResolvedValue({});

    // Act
    renderWithQueryClient(<SimpleVerifyEmailForm email={email} />);
    const button = screen.getByRole("button", {
      name: /resend confirmation email/i,
    });
    await user.click(button);

    // Assert
    await waitFor(() => {
      expect(mockMutationState.mutateAsync).toHaveBeenCalledWith({ email });
    });
  });
});

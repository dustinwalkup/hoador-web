import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimpleVerifyEmailForm } from "../simple-verify-email-form";

// Mock server action
vi.mock("../actions/verify-email", () => ({
  resendVerificationEmailAction: vi.fn(),
}));

// Mock useActionState
type ActionState = { success: boolean; error?: string; message?: string };
const mockFormAction = vi.fn();
const mockUseActionState = vi.fn<
  () => [ActionState, typeof mockFormAction, boolean]
>(() => [{ success: false }, mockFormAction, false]);

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: () => mockUseActionState(),
  };
});

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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Mail: () => <span data-testid="mail-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  CheckCircle: () => <span data-testid="check-circle-icon" />,
}));

describe("SimpleVerifyEmailForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockReturnValue([
      { success: false },
      mockFormAction,
      false,
    ]);
  });

  it("should render email verification header", () => {
    // Arrange
    const email = "test@example.com";

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(email))).toBeInTheDocument();
  });

  it("should render resend email button", () => {
    // Arrange
    const email = "test@example.com";

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /resend confirmation email/i }),
    ).toBeInTheDocument();
  });

  it("should show error message when state.error is present", () => {
    // Arrange
    const email = "test@example.com";
    mockUseActionState.mockReturnValue([
      { success: false, error: "Failed to send email" },
      mockFormAction,
      false,
    ]);

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText("Failed to send email")).toBeInTheDocument();
  });

  it("should show success message when state.success is true", () => {
    // Arrange
    const email = "test@example.com";
    mockUseActionState.mockReturnValue([
      { success: true, message: "Email sent successfully" },
      mockFormAction,
      false,
    ]);

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText("Email sent successfully")).toBeInTheDocument();
  });

  it("should show loading state during submission", () => {
    // Arrange
    const email = "test@example.com";
    mockUseActionState.mockReturnValue([
      { success: false },
      mockFormAction,
      true,
    ]);

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should include hidden email field in form", () => {
    // Arrange
    const email = "test@example.com";

    // Act
    render(<SimpleVerifyEmailForm email={email} />);

    // Assert
    const hiddenInput = screen.getByDisplayValue(email);
    expect(hiddenInput).toHaveAttribute("type", "hidden");
    expect(hiddenInput).toHaveAttribute("name", "email");
  });
});

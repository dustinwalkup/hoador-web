import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a mock mutation object that can be modified between tests
let mockSignupMutationState = {
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

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "../signup-form";
import { renderWithQueryClient } from "@/test/utils/render-helpers";

// Mock Next.js
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    p: ({ children, className, ...props }: any) => (
      <p className={className} {...props}>
        {children}
      </p>
    ),
    button: ({ children, onClick, disabled, type, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} type={type} {...props}>
        {children}
      </button>
    ),
  },
}));

// Mock auth client
const { mockSignInSocial } = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
}));

vi.mock("@/services/better-auth/client", () => ({
  authClient: {
    signIn: {
      social: (...args: any[]) => mockSignInSocial(...args),
    },
  },
}));

// Mock the useSignup hook
vi.mock("../../hooks/use-auth-mutations", () => ({
  useSignup: () => mockSignupMutationState,
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ id, type, placeholder, disabled, ...props }: any) => (
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, variant }: any) => (
    <div role="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ id, checked, onCheckedChange, disabled }: any) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
    />
  ),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  Eye: () => <span data-testid="eye-icon">Eye</span>,
  EyeOff: () => <span data-testid="eye-off-icon">EyeOff</span>,
  Loader2: ({ className }: any) => (
    <span className={className} data-testid="loader-icon">
      Loader
    </span>
  ),
}));

vi.mock("../../../../public/svg/google-icon", () => ({
  GoogleIcon: ({ className }: any) => (
    <span className={className} data-testid="google-icon">
      Google
    </span>
  ),
}));

// Mock animated-form-field variants
vi.mock("../animated-form-field", () => ({
  containerVariants: {},
  fieldVariants: {},
}));

describe("SignupForm", () => {
  const defaultProps = {
    documentUrls: {
      tos: "/documents/terms-of-service.pdf",
      privacy: "/documents/privacy-policy.pdf",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutation state to default
    mockSignupMutationState = {
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("should render all form fields", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("should render Google sign up button", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("should render create account submit button", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("should render legal acceptance checkbox", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("checkbox", { name: /i agree to the/i }),
    ).toBeInTheDocument();
  });

  it("should render links to terms of service and privacy policy", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toHaveAttribute("href", "/documents/terms-of-service.pdf");
    expect(
      screen.getByRole("link", { name: /privacy policy/i }),
    ).toHaveAttribute("href", "/documents/privacy-policy.pdf");
  });

  it("should toggle password visibility", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithQueryClient(<SignupForm {...defaultProps} />);
    const passwordInput = screen.getByPlaceholderText(
      /create a strong password/i,
    );
    const toggleButton = screen.getByRole("button", { name: /eye/i });

    // Act
    await user.click(toggleButton);

    // Assert
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("should disable submit button when legal not accepted", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit button when legal accepted", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithQueryClient(<SignupForm {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /i agree to the/i,
    });

    // Act
    await user.click(checkbox);

    // Assert
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    });
    expect(submitButton).not.toBeDisabled();
  });

  it("should show error message when mutation.isError is true", () => {
    // Arrange
    mockSignupMutationState = {
      mutateAsync: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("Email already exists"),
    };

    // Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByText("Email already exists")).toBeInTheDocument();
  });

  it("should disable form during submission", () => {
    // Arrange
    mockSignupMutationState = {
      mutateAsync: vi.fn(),
      isPending: true,
      isError: false,
      error: null,
    };

    // Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    const submitButton = screen.getByRole("button", {
      name: /creating account/i,
    });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
  });

  it("should handle Google signup", async () => {
    // Arrange
    mockSignInSocial.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQueryClient(<SignupForm {...defaultProps} />);
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    // Act
    await user.click(googleButton);

    // Assert
    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/signup/google/callback",
      });
    });
  });

  it("should call mutation on form submission", async () => {
    // Arrange
    const user = userEvent.setup();
    mockSignupMutationState.mutateAsync = vi.fn().mockResolvedValue({});
    renderWithQueryClient(<SignupForm {...defaultProps} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /i agree to the/i,
    });
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    });

    // Act
    await user.click(checkbox);
    await user.type(firstNameInput, "John");
    await user.type(lastNameInput, "Doe");
    await user.type(emailInput, "john@example.com");
    await user.type(passwordInput, "Password123!");
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockSignupMutationState.mutateAsync).toHaveBeenCalled();
    });
  });

  it("should render password requirements text", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByText(
        /must be at least 8 characters with uppercase, lowercase, and number/i,
      ),
    ).toBeInTheDocument();
  });

  it("should render divider text", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
  });

  it("should render all form sections", () => {
    // Arrange & Act
    renderWithQueryClient(<SignupForm {...defaultProps} />);

    // Assert - form renders with all key elements
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("should show loading state on Google button during signup", async () => {
    // Arrange
    mockSignInSocial.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    const user = userEvent.setup();
    renderWithQueryClient(<SignupForm {...defaultProps} />);
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    // Act
    await user.click(googleButton);

    // Assert
    await waitFor(() => {
      expect(googleButton).toBeDisabled();
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });
  });
});

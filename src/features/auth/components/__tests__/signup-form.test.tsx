import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "../signup-form";

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
    button: ({ children, onClick, disabled, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} {...props}>
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

// Mock server action
const { mockSignupAction } = vi.hoisted(() => ({
  mockSignupAction: vi.fn(),
}));

vi.mock("../actions/signup", () => ({
  signupAction: mockSignupAction,
}));

// Mock useActionState
type ActionState = {
  success: boolean;
  error?: string;
  message?: string;
} | null;

const {
  mockFormAction,
  mockUseActionState,
  mockStartTransition,
  mockUseTransition,
} = vi.hoisted(() => {
  const mockFormActionFn = vi.fn();
  const mockUseActionStateFn = vi.fn<
    () => [ActionState, typeof mockFormActionFn, boolean]
  >(() => [null, mockFormActionFn, false]);

  const mockStartTransitionFn = vi.fn((callback: () => void) => {
    callback();
  });
  const mockUseTransitionFn = vi.fn(() => [false, mockStartTransitionFn]);

  return {
    mockFormAction: mockFormActionFn,
    mockUseActionState: mockUseActionStateFn,
    mockStartTransition: mockStartTransitionFn,
    mockUseTransition: mockUseTransitionFn,
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  // Access hoisted variables from closure
  return {
    ...actual,
    useActionState: mockUseActionState,
    useTransition: mockUseTransition,
  };
});

// Mock react-hook-form
const { mockRegister, mockSetValue, mockWatch, mockHandleSubmit } = vi.hoisted(
  () => {
    const mockRegisterFn = vi.fn((name: string) => ({
      name,
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: vi.fn(),
    }));

    const mockSetValueFn = vi.fn();
    const mockWatchFn = vi.fn(() => false);
    const mockHandleSubmitFn = vi.fn(
      (callback: (data: any) => Promise<void>) => {
        return (e: React.FormEvent) => {
          e.preventDefault();
          const formData = new FormData(e.target as HTMLFormElement);
          const data = {
            firstName: formData.get("firstName") || "",
            lastName: formData.get("lastName") || "",
            email: formData.get("email") || "",
            password: formData.get("password") || "",
            legalAccepted: formData.get("legalAccepted") === "true",
          };
          return callback(data);
        };
      },
    );

    return {
      mockRegister: mockRegisterFn,
      mockSetValue: mockSetValueFn,
      mockWatch: mockWatchFn,
      mockHandleSubmit: mockHandleSubmitFn,
    };
  },
);

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: mockRegister,
    handleSubmit: mockHandleSubmit,
    setValue: mockSetValue,
    watch: mockWatch,
    formState: {
      errors: {},
    },
  }),
  zodResolver: vi.fn(),
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

// Mock AnimatedFormField
vi.mock("../animated-form-field", () => ({
  AnimatedFormField: ({ children, delay }: any) => (
    <div data-testid="animated-form-field" data-delay={delay}>
      {children}
    </div>
  ),
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
    mockUseActionState.mockReturnValue([null, mockFormAction, false]);
    mockUseTransition.mockReturnValue([false, mockStartTransition]);
  });

  it("should render all form fields", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("should render Google sign up button", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("should render create account submit button", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("should render legal acceptance checkbox", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByRole("checkbox", { name: /i agree to the/i }),
    ).toBeInTheDocument();
  });

  it("should render links to terms of service and privacy policy", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

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
    render(<SignupForm {...defaultProps} />);
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
    render(<SignupForm {...defaultProps} />);

    // Assert
    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("should enable submit button when legal accepted", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SignupForm {...defaultProps} />);
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

  it("should show error message when state.error is present", () => {
    // Arrange
    mockUseActionState.mockReturnValue([
      { success: false, error: "Email already exists" },
      mockFormAction,
      false,
    ]);

    // Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByText("Email already exists")).toBeInTheDocument();
  });

  it("should disable form during submission", () => {
    // Arrange
    mockUseActionState.mockReturnValue([null, mockFormAction, true]);

    // Act
    render(<SignupForm {...defaultProps} />);

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
    render(<SignupForm {...defaultProps} />);
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

  it("should call formAction on form submission", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SignupForm {...defaultProps} />);
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
    await user.type(passwordInput, "Password123");
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockStartTransition).toHaveBeenCalled();
      expect(mockFormAction).toHaveBeenCalled();
    });
  });

  it("should render password requirements text", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(
      screen.getByText(
        /must be at least 8 characters with uppercase, lowercase, and number/i,
      ),
    ).toBeInTheDocument();
  });

  it("should render divider text", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
  });

  it("should render AnimatedFormField components", () => {
    // Arrange & Act
    render(<SignupForm {...defaultProps} />);

    // Assert
    const animatedFields = screen.getAllByTestId("animated-form-field");
    expect(animatedFields.length).toBeGreaterThan(0);
  });

  it("should show loading state on Google button during signup", async () => {
    // Arrange
    mockSignInSocial.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    const user = userEvent.setup();
    render(<SignupForm {...defaultProps} />);
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

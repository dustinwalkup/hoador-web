import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../login-form";

// Mock Next.js
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  redirect: (...args: any[]) => mockRedirect(...args),
}));

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

// Mock auth utilities - must be hoisted to be available in mock factory
const { mockSignInEmail, mockSignInSocial } = vi.hoisted(() => {
  const mockSignInEmailFn = vi.fn();
  const mockSignInSocialFn = vi.fn();

  return {
    mockSignInEmail: mockSignInEmailFn,
    mockSignInSocial: mockSignInSocialFn,
  };
});

vi.mock("../../utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils")>();
  return {
    ...actual,
    signInEmail: mockSignInEmail,
    signInSocial: mockSignInSocial,
  };
});

// Mock tryCatch - the real tryCatch takes a Promise directly, not a function
const { mockTryCatch } = vi.hoisted(() => {
  const mockTryCatchFn = vi.fn(async (promise: Promise<any>) => {
    try {
      const result = await promise;
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  });

  return {
    mockTryCatch: mockTryCatchFn,
  };
});

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: (promise: Promise<any>) => mockTryCatch(promise),
}));

// Mock react-hook-form
const mockRegister = vi.fn((name: string) => ({
  name,
  onChange: vi.fn(),
  onBlur: vi.fn(),
  ref: vi.fn(),
}));

const mockHandleSubmit = vi.fn((callback: (data: any) => Promise<void>) => {
  return (e: React.FormEvent) => {
    e.preventDefault();
    // Mock form data extraction
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      email: formData.get("email") || "",
      password: formData.get("password") || "",
    };
    return callback(data);
  };
});

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: mockRegister,
    handleSubmit: mockHandleSubmit,
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

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    // Reset mocks to return undefined by default
    mockSignInEmail.mockReset();
    mockSignInSocial.mockReset();
    mockTryCatch.mockReset();
    // Reset tryCatch to default implementation that wraps a promise
    mockTryCatch.mockImplementation(async (promise: Promise<any>) => {
      try {
        const result = await promise;
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    });
    // Set default mock implementations
    mockSignInEmail.mockResolvedValue(undefined);
    mockSignInSocial.mockResolvedValue(undefined);
  });

  it("should render email input field", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/john@example.com/i),
    ).toBeInTheDocument();
  });

  it("should render password input field", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your password/i),
    ).toBeInTheDocument();
  });

  it("should render Google sign in button", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("should render sign in submit button", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("should toggle password visibility", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    const toggleButton = screen.getByRole("button", { name: /eye/i });

    // Act
    await user.click(toggleButton);

    // Assert
    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("should show error message on failed login", async () => {
    // Arrange
    // Throw an actual Error object so authError.message works correctly
    mockSignInEmail.mockRejectedValueOnce(new Error("invalid credentials"));
    const user = userEvent.setup();

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    // Assert
    await waitFor(
      () => {
        expect(mockSignInEmail).toHaveBeenCalledWith(
          "test@example.com",
          "wrongpassword",
          "/dashboard",
        );
      },
      { timeout: 1000 },
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(/invalid email or password/i),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("should show network error message when sign in fails with fetch error", async () => {
    mockSignInEmail.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(
      screen.getByPlaceholderText(/enter your password/i),
      "pass",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't reach the server/i),
      ).toBeInTheDocument();
    });
  });

  it("should show email not verified message when sign in fails with email not verified", async () => {
    mockSignInEmail.mockRejectedValueOnce(new Error("email not verified"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(
      screen.getByPlaceholderText(/enter your password/i),
      "pass",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/please verify your email address before signing in/i),
      ).toBeInTheDocument();
    });
  });

  it("should show generic sign in error for unknown auth errors", async () => {
    mockSignInEmail.mockRejectedValueOnce(
      new Error("Something unexpected happened"),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(
      screen.getByPlaceholderText(/enter your password/i),
      "pass",
    );
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to sign in\. please try again/i),
      ).toBeInTheDocument();
    });
  });

  it("should show network error when Google sign in fails with fetch error", async () => {
    mockSignInSocial.mockRejectedValueOnce(new Error("Failed to fetch"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't reach the server/i),
      ).toBeInTheDocument();
    });
  });

  it("should show generic error when Google sign in fails with non-network error", async () => {
    mockSignInSocial.mockRejectedValueOnce(new Error("Google sign in failed"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/failed to sign in with google\. please try again/i),
      ).toBeInTheDocument();
    });
  });

  it("should disable form during loading", async () => {
    // Arrange
    let resolvePromise: (value?: void) => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    // Use mockImplementationOnce to return a promise that stays pending
    mockSignInEmail.mockImplementationOnce(() => pendingPromise);
    const user = userEvent.setup();

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Act
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    // Don't await the click - we want to check loading state immediately
    user.click(submitButton);

    // Assert - check loading state appears
    await waitFor(
      () => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    const loadingButton = screen.getByRole("button", { name: /signing in/i });
    expect(loadingButton).toBeDisabled();

    // Cleanup: resolve the promise to avoid hanging
    resolvePromise!();
    await pendingPromise;
  });

  it("should handle Google sign in", async () => {
    // Arrange
    mockSignInSocial.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<LoginForm />);
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    // Act
    await user.click(googleButton);

    // Assert
    await waitFor(
      () => {
        expect(mockSignInSocial).toHaveBeenCalledWith("google", "/dashboard");
      },
      { timeout: 2000 },
    );
  });

  it("should use callbackUrl from search params", async () => {
    // Arrange
    const searchParams = new URLSearchParams();
    searchParams.set("callbackUrl", "/custom/path");
    mockUseSearchParams.mockReturnValue(searchParams);
    mockSignInSocial.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<LoginForm />);
    const googleButton = screen.getByRole("button", {
      name: /continue with google/i,
    });

    // Act
    await user.click(googleButton);

    // Assert
    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledWith("google", "/custom/path");
    });
  });

  it("should show link to forgot password", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  // Note: The "Sign up" link is rendered in the login page component,
  // not in the LoginForm component itself. Test it in the page tests.

  it("should render divider text", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
  });

  it("should render all form sections", () => {
    // Arrange & Act
    render(<LoginForm />);

    // Assert - form renders with all key elements
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});

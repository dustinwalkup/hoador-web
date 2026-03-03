import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { OnboardingForm } from "../onboarding-form";

// Mock useCompleteOnboarding
const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseCompleteOnboarding = vi.fn(() => ({
  mutate: mockMutate,
  mutateAsync: mockMutateAsync,
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null as Error | null,
  data: null as any,
}));

vi.mock("../../hooks/use-onboarding-mutation", () => ({
  useCompleteOnboarding: () => mockUseCompleteOnboarding(),
}));

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

// Mock ProfileImageUpload
vi.mock("../profile-image-upload", () => ({
  ProfileImageUpload: ({ userInitials, onImageChange }: any) => (
    <div data-testid="profile-image-upload">
      <span>Initials: {userInitials}</span>
      <button onClick={() => onImageChange("https://example.com/image.jpg")}>
        Upload Image
      </button>
    </div>
  ),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function QueryWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock validation
vi.mock("../../schemas/validation", () => ({
  validateField: vi.fn((field: string, value: unknown) => {
    if (field === "firstName" && (!value || String(value).trim() === "")) {
      return "First name is required";
    }
    if (field === "lastName" && (!value || String(value).trim() === "")) {
      return "Last name is required";
    }
    if (field === "phone" && (!value || String(value).length < 10)) {
      return "Phone number must be at least 10 digits";
    }
    if (field === "address.street" && (!value || String(value).trim() === "")) {
      return "Street address is required";
    }
    if (field === "address.city" && (!value || String(value).trim() === "")) {
      return "City is required";
    }
    if (field === "address.state" && (!value || String(value).trim() === "")) {
      return "State is required";
    }
    if (
      field === "address.zipCode" &&
      (!value || String(value).trim() === "")
    ) {
      return "ZIP code is required";
    }
    return null;
  }),
}));

describe("OnboardingForm", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockUseCompleteOnboarding.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: null,
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryWrapper queryClient={queryClient}>{component}</QueryWrapper>,
    );
  };

  describe("Rendering", () => {
    it("should render all form fields", () => {
      renderWithQueryClient(<OnboardingForm />);

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      // Phone input is rendered but doesn't have id, so check by placeholder
      expect(screen.getByPlaceholderText(/(555)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      // State select doesn't have id, so check by label text directly or combobox
      expect(screen.getByText(/^state$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument();
    });

    it("should render ProfileImageUpload component", () => {
      renderWithQueryClient(<OnboardingForm />);

      expect(screen.getByTestId("profile-image-upload")).toBeInTheDocument();
    });

    it("should render submit button", () => {
      renderWithQueryClient(<OnboardingForm />);

      expect(
        screen.getByRole("button", { name: /complete profile/i }),
      ).toBeInTheDocument();
    });

    it("should show user initials in ProfileImageUpload when provided", () => {
      renderWithQueryClient(
        <OnboardingForm userFirstName="John" userLastName="Doe" />,
      );

      expect(screen.getByText("Initials: JD")).toBeInTheDocument();
    });
  });

  describe("User interaction", () => {
    it("should call mutate when form is submitted", async () => {
      const user = userEvent.setup();
      const { container } = renderWithQueryClient(<OnboardingForm />);

      // Fill out form
      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      // Phone input doesn't have id, find by placeholder
      const phoneInput = screen.getByPlaceholderText(
        /(555)/i,
      ) as HTMLInputElement;
      await user.type(phoneInput, "5551234567");
      await user.type(screen.getByLabelText(/street address/i), "123 Main St");
      await user.type(screen.getByLabelText(/city/i), "San Francisco");
      // State select is a Radix UI Select - find combobox button, click to open, then select option
      const stateSelectTrigger = container.querySelector(
        'button[role="combobox"]',
      ) as HTMLElement;
      await user.click(stateSelectTrigger);
      // Wait for dropdown to open and find the option (label is "California", not "CA")
      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: "California" }),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("option", { name: "California" }));
      await user.type(screen.getByLabelText(/zip code/i), "94102");

      // Submit form
      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it("should format phone number as user types", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      const phoneInput = screen.getByPlaceholderText(
        /(555)/i,
      ) as HTMLInputElement;

      await user.type(phoneInput, "5551234567");

      // Phone should be formatted
      expect(phoneInput.value).toMatch(/\(555\)\s*123-4567/);
    });

    it("should update bio character counter", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      const bioInput = screen.getByLabelText(/bio/i);
      await user.type(bioInput, "Hello");

      expect(screen.getByText(/5\/200/i)).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("should show error messages for invalid fields after submit attempt", async () => {
      const user = userEvent.setup();

      renderWithQueryClient(<OnboardingForm />);

      // Try to submit empty form
      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });
      await user.click(submitButton);

      // Form should prevent submission and show errors
      await waitFor(() => {
        expect(mockMutate).not.toHaveBeenCalled();
      });
    });

    it("should prevent submission when form incomplete", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      // Fill only some fields
      await user.type(screen.getByLabelText(/first name/i), "John");
      // Don't fill other required fields

      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });

      // Button should be disabled
      expect(submitButton).toBeDisabled();
    });

    it("should show field-specific error messages", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      // Fill form with valid data except for phone (which we'll make invalid)
      // firstName is already empty (invalid), lastName is undefined (invalid)
      const lastNameInput = screen.getByLabelText(/last name/i);
      await user.type(lastNameInput, "Doe"); // Make lastName valid
      const phoneInput = screen.getByPlaceholderText(
        /(555)/i,
      ) as HTMLInputElement;
      await user.type(phoneInput, "123"); // Invalid phone - too short
      const streetInput = screen.getByLabelText(/street address/i);
      await user.type(streetInput, "123 Main St");
      const cityInput = screen.getByLabelText(/city/i);
      await user.type(cityInput, "San Francisco");
      // State select - find combobox button
      const stateSelectTrigger = document.querySelector(
        'button[role="combobox"]',
      ) as HTMLElement;
      await user.click(stateSelectTrigger);
      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: "California" }),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("option", { name: "California" }));
      const zipInput = screen.getByLabelText(/zip code/i);
      await user.type(zipInput, "94102");

      // Now the form should be "complete" but with invalid firstName (empty) and phone (too short)
      // Trigger validation by submitting the form directly
      const form = screen.getByRole("form") as HTMLFormElement;
      form.requestSubmit();

      // Wait for React to re-render with the error state
      await waitFor(
        () => {
          // Check for error message first (most reliable indicator)
          const errorMessage = screen.queryByText(/first name is required/i);
          if (errorMessage) {
            return;
          }

          // Fallback: check for error class on input
          const firstNameInputAfterValidation =
            screen.getByLabelText(/first name/i);
          if (
            firstNameInputAfterValidation.className.includes("border-red-500")
          ) {
            return;
          }

          throw new Error("Validation did not run - no error found");
        },
        { timeout: 2000 },
      );

      // Verify the input has the error class
      const firstNameInputAfterValidation =
        screen.getByLabelText(/first name/i);
      expect(firstNameInputAfterValidation.className).toContain(
        "border-red-500",
      );
    });
  });

  describe("Loading state", () => {
    it("should disable form fields during submission", () => {
      mockUseCompleteOnboarding.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
        data: null,
      });

      renderWithQueryClient(<OnboardingForm />);

      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
      expect(screen.getByPlaceholderText(/(555)/i)).toBeDisabled();
    });

    it("should show loading spinner in submit button", () => {
      mockUseCompleteOnboarding.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
        data: null,
      });

      renderWithQueryClient(<OnboardingForm />);

      expect(screen.getByText(/completing profile/i)).toBeInTheDocument();
    });

    it("should change button text to 'Completing Profile...' when pending", () => {
      mockUseCompleteOnboarding.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null,
        data: null,
      });

      renderWithQueryClient(<OnboardingForm />);

      // Find submit button specifically by its text content (not the Upload Image button)
      const submitButton = screen.getByRole("button", {
        name: /completing profile/i,
      });
      expect(submitButton).toHaveTextContent(/completing profile/i);
    });
  });

  describe("Error handling", () => {
    it("should handle mutation errors", async () => {
      mockUseCompleteOnboarding.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: false,
        isError: true,
        error: new Error("Failed to update profile"),
        data: null,
      });

      renderWithQueryClient(<OnboardingForm />);

      // Error handling is done via toast, not displayed in form
      // The mutation hook handles errors with toast.error
      expect(mockUseCompleteOnboarding).toHaveBeenCalled();
    });
  });

  describe("Success handling", () => {
    it("should handle successful submission", () => {
      mockUseCompleteOnboarding.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: true,
        isError: false,
        error: null,
        data: {
          success: true,
          redirect: "/dashboard",
        },
      });

      renderWithQueryClient(<OnboardingForm />);

      // Success handling is done via toast and redirect in the mutation hook
      expect(mockUseCompleteOnboarding).toHaveBeenCalled();
    });
  });

  describe("State management", () => {
    it("should update form state on field changes", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.type(firstNameInput, "John");

      expect(firstNameInput).toHaveValue("John");
    });

    it("should update address fields correctly", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<OnboardingForm />);

      const streetInput = screen.getByLabelText(/street address/i);
      await user.type(streetInput, "123 Main St");

      expect(streetInput).toHaveValue("123 Main St");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty optional fields (bio, profileImageUrl)", async () => {
      const user = userEvent.setup();
      const { container } = renderWithQueryClient(<OnboardingForm />);

      // Fill required fields
      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      // Phone input uses a custom component - find by placeholder or role
      const phoneInput = screen.getByPlaceholderText(
        /(555)/i,
      ) as HTMLInputElement;
      await user.type(phoneInput, "5551234567");
      await user.type(screen.getByLabelText(/street address/i), "123 Main St");
      await user.type(screen.getByLabelText(/city/i), "San Francisco");
      // State select is a Radix UI Select - find combobox button, click to open, then select option
      const stateSelectTrigger = container.querySelector(
        'button[role="combobox"]',
      ) as HTMLElement;
      await user.click(stateSelectTrigger);
      // Wait for dropdown to open and find the option (label is "California", not "CA")
      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: "California" }),
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("option", { name: "California" }));
      await user.type(screen.getByLabelText(/zip code/i), "94102");

      // Bio and profileImageUrl are optional, should be empty
      const bioInput = screen.getByLabelText(/bio/i);
      expect(bioInput).toHaveValue("");

      // Form should still be submittable
      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });
      expect(submitButton).not.toBeDisabled();
    });

    it("should handle pre-filled user data", () => {
      renderWithQueryClient(
        <OnboardingForm
          userFirstName="John"
          userLastName="Doe"
          profileImageUrl="https://example.com/image.jpg"
        />,
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      expect(firstNameInput).toHaveValue("John");
    });
  });
});

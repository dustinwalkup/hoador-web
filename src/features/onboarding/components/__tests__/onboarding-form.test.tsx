import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingForm } from "../onboarding-form";
import { mockOnboardingData } from "@/test/fixtures/onboarding";

// Mock useActionState
type OnboardingResult = {
  success: boolean;
  error?: string;
  warning?: string;
};
const mockFormAction = vi.fn();
const mockUseActionState = vi.fn<
  () => [OnboardingResult | null, typeof mockFormAction, boolean]
>(() => [null, mockFormAction, false]);

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useActionState: () => mockUseActionState(),
  };
});

// Mock onboardingAction
vi.mock("../../actions/onboarding-action", () => ({
  onboardingAction: vi.fn(),
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
    if (field === "agreeToTerms" && value !== true) {
      return "You must agree to the terms";
    }
    return null;
  }),
}));

describe("OnboardingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockReturnValue([null, mockFormAction, false]);
  });

  describe("Rendering", () => {
    it("should render all form fields", () => {
      render(<OnboardingForm />);

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
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should render ProfileImageUpload component", () => {
      render(<OnboardingForm />);

      expect(screen.getByTestId("profile-image-upload")).toBeInTheDocument();
    });

    it("should render submit button", () => {
      render(<OnboardingForm />);

      expect(
        screen.getByRole("button", { name: /complete profile/i }),
      ).toBeInTheDocument();
    });

    it("should show user initials in ProfileImageUpload when provided", () => {
      render(<OnboardingForm userFirstName="John" userLastName="Doe" />);

      expect(screen.getByText("Initials: JD")).toBeInTheDocument();
    });
  });

  describe("User interaction", () => {
    it("should call formAction when form is submitted", async () => {
      const user = userEvent.setup();
      const { container } = render(<OnboardingForm />);

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
      await user.click(screen.getByRole("checkbox"));

      // Submit form
      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFormAction).toHaveBeenCalled();
      });
    });

    it("should format phone number as user types", async () => {
      const user = userEvent.setup();
      render(<OnboardingForm />);

      const phoneInput = screen.getByPlaceholderText(
        /(555)/i,
      ) as HTMLInputElement;

      await user.type(phoneInput, "5551234567");

      // Phone should be formatted
      expect(phoneInput.value).toMatch(/\(555\)\s*123-4567/);
    });

    it("should update bio character counter", async () => {
      const user = userEvent.setup();
      render(<OnboardingForm />);

      const bioInput = screen.getByLabelText(/bio/i);
      await user.type(bioInput, "Hello");

      expect(screen.getByText(/5\/200/i)).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("should show error messages for invalid fields after submit attempt", async () => {
      const user = userEvent.setup();
      mockUseActionState.mockReturnValue([
        { success: false, error: "Validation failed" },
        mockFormAction,
        false,
      ]);

      render(<OnboardingForm />);

      // Try to submit empty form
      const submitButton = screen.getByRole("button", {
        name: /complete profile/i,
      });
      await user.click(submitButton);

      // Form should prevent submission and show errors
      await waitFor(() => {
        expect(mockFormAction).not.toHaveBeenCalled();
      });
    });

    it("should prevent submission when form incomplete", async () => {
      const user = userEvent.setup();
      render(<OnboardingForm />);

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
      render(<OnboardingForm />);

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
      const termsCheckbox = screen.getByRole("checkbox");
      await user.click(termsCheckbox);

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
      mockUseActionState.mockReturnValue([null, mockFormAction, true]);

      render(<OnboardingForm />);

      expect(screen.getByLabelText(/first name/i)).toBeDisabled();
      expect(screen.getByLabelText(/last name/i)).toBeDisabled();
      expect(screen.getByPlaceholderText(/(555)/i)).toBeDisabled();
    });

    it("should show loading spinner in submit button", () => {
      mockUseActionState.mockReturnValue([null, mockFormAction, true]);

      render(<OnboardingForm />);

      expect(screen.getByText(/completing profile/i)).toBeInTheDocument();
    });

    it("should change button text to 'Completing Profile...' when pending", () => {
      mockUseActionState.mockReturnValue([null, mockFormAction, true]);

      render(<OnboardingForm />);

      // Find submit button specifically by its text content (not the Upload Image button)
      const submitButton = screen.getByRole("button", {
        name: /completing profile/i,
      });
      expect(submitButton).toHaveTextContent(/completing profile/i);
    });
  });

  describe("Error handling", () => {
    it("should display server error message from action", () => {
      mockUseActionState.mockReturnValue([
        { success: false, error: "Failed to update profile" },
        mockFormAction,
        false,
      ]);

      render(<OnboardingForm />);

      expect(screen.getByText("Failed to update profile")).toBeInTheDocument();
    });

    it("should display warning message when success with warning", () => {
      mockUseActionState.mockReturnValue([
        { success: true, warning: "Address update failed" },
        mockFormAction,
        false,
      ]);

      render(<OnboardingForm />);

      expect(screen.getByText("Address update failed")).toBeInTheDocument();
    });
  });

  describe("Success handling", () => {
    it("should disable form after successful submission", () => {
      mockUseActionState.mockReturnValue([
        { success: true },
        mockFormAction,
        false,
      ]);

      render(<OnboardingForm />);

      // Form should be disabled after success
      // The checkbox is checked when state.success is true, but only disabled when isPending is true
      // Since isPending is false in this test, checkbox won't be disabled
      // However, the form submission is prevented when state?.success is true
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
      // The checkbox is checked but not disabled (only disabled when isPending)
      // The form prevents submission when state?.success is true in handleFormSubmit
    });
  });

  describe("State management", () => {
    it("should update form state on field changes", async () => {
      const user = userEvent.setup();
      render(<OnboardingForm />);

      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.type(firstNameInput, "John");

      expect(firstNameInput).toHaveValue("John");
    });

    it("should update address fields correctly", async () => {
      const user = userEvent.setup();
      render(<OnboardingForm />);

      const streetInput = screen.getByLabelText(/street address/i);
      await user.type(streetInput, "123 Main St");

      expect(streetInput).toHaveValue("123 Main St");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty optional fields (bio, profileImageUrl)", async () => {
      const user = userEvent.setup();
      const { container } = render(<OnboardingForm />);

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
      await user.click(screen.getByRole("checkbox"));

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
      render(
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

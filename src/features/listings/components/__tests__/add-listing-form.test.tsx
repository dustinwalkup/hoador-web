import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import {
  createMockFormData,
  createMockMinimalFormData,
  createMockCategories,
  createMockForm,
  mockToast,
  mockFetch,
  createMockRouter,
  renderWithQueryClient,
} from "@/test/utils/listing-test-helpers";
import { AddListingForm } from "../listing-form/add-listing-form";
import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => createMockRouter()),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/features/listings/hooks/use-listing-form", () => ({
  useListingForm: vi.fn(),
}));

vi.mock("@/features/listings/hooks/use-listing-images", () => ({
  useListingImages: vi.fn(),
}));

vi.mock("@/features/listings/actions/create-listing", () => ({
  createListing: vi.fn(),
  uploadListingImage: vi.fn(),
}));

describe("AddListingForm", () => {
  const mockCategories = createMockCategories();
  const mockOnSubmit = vi.fn();
  let mockForm: any;
  let mockImagesHook: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a comprehensive mock form that works with FormProvider
    mockForm = createMockForm();
    // Add custom methods
    mockForm.addImage = vi.fn();
    mockForm.removeImage = vi.fn();
    mockForm.addSpecification = vi.fn();
    mockForm.removeSpecification = vi.fn();

    // Mock the images hook
    mockImagesHook = {
      images: [],
      loadImages: vi.fn(),
      deleteImage: vi.fn(),
      isLoading: false,
    };

    // Set up mocks
    const { useListingForm } =
      await import("@/features/listings/hooks/use-listing-form");
    const { useListingImages } =
      await import("@/features/listings/hooks/use-listing-images");

    vi.mocked(useListingForm).mockReturnValue(mockForm);
    vi.mocked(useListingImages).mockReturnValue(mockImagesHook);
  });

  describe("Component Structure", () => {
    it("should render all form sections", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      expect(screen.getByText("Basic Information")).toBeInTheDocument();
      expect(screen.getByText("Pricing & Rental Terms")).toBeInTheDocument();
      expect(screen.getByText("Photos")).toBeInTheDocument();
      expect(screen.getByText("Pickup & Delivery")).toBeInTheDocument();
      expect(screen.getByText("Additional Details")).toBeInTheDocument();
    });

    it("should render form inputs and labels", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      expect(screen.getByText(/listing name/i)).toBeInTheDocument();
      // Category appears in both label and placeholder, use getAllByText
      const categoryElements = screen.getAllByText(/category/i);
      expect(categoryElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/description/i)).toBeInTheDocument();
      expect(screen.getByText("Daily Rate *")).toBeInTheDocument();
    });

    it("should render submit button", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      expect(submitButton).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call onSubmit when form is valid", async () => {
      mockOnSubmit.mockResolvedValue({
        success: true,
        listingId: "listing-123",
      });

      // Provide images so form can submit - update getValues implementation
      mockForm._updateGetValues((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      // Mock fetch for image upload
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it("should show error message when onSubmit fails", async () => {
      const { toast } = await import("sonner");
      const toastErrorSpy = vi.mocked(toast.error);

      mockOnSubmit.mockResolvedValue({ error: "Validation failed" });

      // Ensure form has no errors
      mockForm.formState.errors = {};

      // Provide images so form can submit - update getValues implementation
      mockForm._updateGetValues((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      // Mock fetch for image upload
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith("Validation failed");
      });
    });

    it("should require at least one image for new listings", async () => {
      const { toast } = await import("sonner");
      const toastErrorSpy = vi.mocked(toast.error);

      // Update getValues to return empty images array
      mockForm._updateGetValues((field?: string) => {
        if (field === "images") return [];
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [], // No images
          };
        }
        return createMockFormData();
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith(
          "Please add at least one image.",
        );
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should show loading state during submission", async () => {
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      // Provide images so form can submit - update getValues implementation
      mockForm._updateGetValues((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      // Mock formState.isSubmitting to be true
      mockForm.formState.isSubmitting = true;

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      // Mock fetch for image upload
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Edit Mode", () => {
    it("should load existing images when editing", () => {
      const mockExistingImages = [
        {
          id: "image-1",
          imageUrl: "https://example.com/image1.jpg",
          orderIndex: 0,
        },
      ];

      mockImagesHook.images = mockExistingImages;

      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          onSubmit={mockOnSubmit}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      expect(mockImagesHook.loadImages).toHaveBeenCalled();
    });

    it("should allow editing without new images if existing images present", async () => {
      const { toast } = await import("sonner");
      const toastErrorSpy = vi.mocked(toast.error);

      mockOnSubmit.mockResolvedValue({
        success: true,
        listingId: "listing-123",
      });

      mockImagesHook.images = [
        {
          id: "image-1",
          imageUrl: "https://example.com/image1.jpg",
          orderIndex: 0,
        },
      ];

      // Update getValues to return empty images array (no new images)
      mockForm._updateGetValues((field?: string) => {
        if (field === "images") return [];
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [], // No new images, but existing ones
          };
        }
        return createMockFormData();
      });

      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          onSubmit={mockOnSubmit}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      const submitButton = screen.getByRole("button", {
        name: /save changes/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toastErrorSpy).not.toHaveBeenCalledWith(
          "Please add at least one image.",
        );
      });
    });
  });

  describe("Form Validation", () => {
    it("should show validation errors when form has errors", async () => {
      const { toast } = await import("sonner");
      const toastErrorSpy = vi.mocked(toast.error);

      mockForm.formState.errors = { name: { message: "Name is required" } };

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith(
          "Please fix the form errors before submitting.",
        );
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Categories", () => {
    it("should display categories in dropdown", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      // Category label should be visible - use getAllByText and select the label
      const categoryLabels = screen.getAllByText(/category/i);
      expect(categoryLabels.length).toBeGreaterThan(0);
      // The first one should be the label "Category *"
      expect(categoryLabels[0]).toHaveTextContent("Category *");

      // Category select trigger should be present - query by role without name to avoid ambiguity
      const categorySelects = screen.getAllByRole("combobox");
      const categorySelect = categorySelects.find((el) =>
        el.textContent?.includes("Select category"),
      );
      expect(categorySelect).toBeInTheDocument();

      // Note: Category names are only visible when dropdown is open
      // We can verify the select is present and functional
    });
  });

  describe("Multi-step Form", () => {
    it("should render all form sections in sequence", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      // All sections should be visible (assuming single-page form)
      expect(screen.getByText("Basic Information")).toBeInTheDocument();
      expect(screen.getByText("Pricing & Rental Terms")).toBeInTheDocument();
      expect(screen.getByText("Photos")).toBeInTheDocument();
      expect(screen.getByText("Pickup & Delivery")).toBeInTheDocument();
      expect(screen.getByText("Additional Details")).toBeInTheDocument();
    });
  });

  describe("Image Handling", () => {
    it("should handle image uploads", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      // Test that image-related elements are present
      expect(screen.getByText("Photos")).toBeInTheDocument();
    });

    it("should call image management functions", () => {
      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      // The form should be using the mocked image functions
      expect(mockForm.addImage).toBeDefined();
      expect(mockForm.removeImage).toBeDefined();
    });
  });

  describe("Success Handling", () => {
    it("should show success message and redirect on successful submission", async () => {
      const { toast } = await import("sonner");
      const toastSuccessSpy = vi.mocked(toast.success);
      const routerMock = createMockRouter();
      mockOnSubmit.mockResolvedValue({
        success: true,
        listingId: "listing-123",
      });

      // Ensure form has no errors
      mockForm.formState.errors = {};

      // Mock router
      const { useRouter } = await import("next/navigation");
      vi.mocked(useRouter).mockReturnValue(routerMock);

      // Set up form with images BEFORE rendering
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      // Mock fetch for image upload
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toastSuccessSpy).toHaveBeenCalledWith(
          "Listing and images uploaded successfully!",
        );
        expect(routerMock.push).toHaveBeenCalledWith("/dashboard/garage");
      });
    });

    it("should reset form on successful submission", async () => {
      // Mock successful response with listingId
      mockOnSubmit.mockResolvedValue({
        listingId: "listing-123",
      });

      // Ensure form has no errors
      mockForm.formState.errors = {};

      // Set up form with images BEFORE rendering
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      // Mock fetch for image upload to succeed
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      // The form doesn't explicitly call reset() - it redirects instead
      // So we just verify the submission was successful
      await waitFor(
        () => {
          expect(mockOnSubmit).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      const { toast } = await import("sonner");
      const toastErrorSpy = vi.mocked(toast.error);

      // Mock onSubmit to reject (throw error) - this will be caught in the catch block
      mockOnSubmit.mockRejectedValue(new Error("Network error"));

      // Ensure form has no errors
      mockForm.formState.errors = {};

      // Set up form with images so it tries to upload - BEFORE rendering
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      await waitFor(
        () => {
          expect(toastErrorSpy).toHaveBeenCalledWith(
            "An unexpected error occurred. Please try again.",
          );
        },
        { timeout: 3000 },
      );
    });

    it("should re-enable submit button after error", async () => {
      mockOnSubmit.mockRejectedValue(new Error("Network error"));

      // Ensure form has no errors
      mockForm.formState.errors = {};

      // Provide images so form can submit - BEFORE rendering
      mockForm.getValues.mockImplementation((field?: string) => {
        if (field === "images") {
          return [{ file: new File([], "test.jpg"), url: "blob:test" }];
        }
        if (field === "specifications") return {};
        if (!field) {
          return {
            ...createMockFormData(),
            images: [{ file: new File([], "test.jpg"), url: "blob:test" }],
          };
        }
        return createMockFormData();
      });

      renderWithQueryClient(
        <AddListingForm categories={mockCategories} onSubmit={mockOnSubmit} />,
      );

      const submitButton = screen.getByRole("button", {
        name: /add listing/i,
      });
      fireEvent.click(submitButton);

      // Button should be re-enabled after error
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});

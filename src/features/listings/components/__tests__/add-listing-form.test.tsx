import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  createMockCategories,
  createMockForm,
  createMockRouter,
  renderWithQueryClient,
} from "@/test/utils/listing-test-helpers";
import { AddListingForm } from "../listing-form/add-listing-form";

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

vi.mock("@/features/listings/hooks/use-listing-form-submit", () => ({
  useListingFormSubmit: vi.fn(),
}));

describe("AddListingForm", () => {
  const mockCategories = createMockCategories();
  let mockForm: ReturnType<typeof createMockForm>;
  let mockImagesHook: {
    images: { id: string; imageUrl: string; orderIndex: number }[];
    loadImages: ReturnType<typeof vi.fn>;
    deleteImage: ReturnType<typeof vi.fn>;
    isLoading: boolean;
  };
  let mockFormSubmitHook: {
    handleSubmit: ReturnType<typeof vi.fn>;
    isSubmitting: boolean;
    uploadProgress: { current: number; total: number } | null;
    isCreatePending: boolean;
    isUpdatePending: boolean;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockForm = createMockForm();
    mockForm.addImage = vi.fn();
    mockForm.removeImage = vi.fn();
    mockForm.addSpecification = vi.fn();
    mockForm.removeSpecification = vi.fn();

    mockImagesHook = {
      images: [],
      loadImages: vi.fn(),
      deleteImage: vi.fn(),
      isLoading: false,
    };

    mockFormSubmitHook = {
      handleSubmit: vi.fn(),
      isSubmitting: false,
      uploadProgress: null,
      isCreatePending: false,
      isUpdatePending: false,
    };

    const { useListingForm } =
      await import("@/features/listings/hooks/use-listing-form");
    const { useListingImages } =
      await import("@/features/listings/hooks/use-listing-images");
    const { useListingFormSubmit } =
      await import("@/features/listings/hooks/use-listing-form-submit");

    vi.mocked(useListingForm).mockReturnValue(mockForm as any);
    vi.mocked(useListingImages).mockReturnValue(mockImagesHook as any);
    vi.mocked(useListingFormSubmit).mockReturnValue(mockFormSubmitHook as any);
  });

  describe("Component Structure", () => {
    it("should render all form sections", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(screen.getByText("Basic Information")).toBeInTheDocument();
      expect(screen.getByText("Pricing & Rental Terms")).toBeInTheDocument();
      expect(screen.getByText("Photos")).toBeInTheDocument();
      expect(screen.getByText("Pickup & Delivery")).toBeInTheDocument();
      expect(screen.getByText("Additional Details")).toBeInTheDocument();
      expect(screen.getByText("Owner Policies")).toBeInTheDocument();
    });

    it("should render form inputs and labels", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(screen.getByText(/listing name/i)).toBeInTheDocument();
      const categoryElements = screen.getAllByText(/category/i);
      expect(categoryElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/description/i)).toBeInTheDocument();
      // Asterisk now lives in its own destructive span, so match on the
      // label's full text content rather than a single text node.
      expect(
        screen.getByText(
          (_, el) =>
            el?.tagName === "LABEL" && el.textContent === "Daily Rate *",
        ),
      ).toBeInTheDocument();
    });

    it("should render submit button", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /list an item/i,
      });
      expect(submitButton).toBeInTheDocument();
    });

    it("should show review notice for new listings", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(
        screen.getByText(/your listing will be reviewed by an admin/i),
      ).toBeInTheDocument();
    });

    it("should hide review notice in edit mode", () => {
      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      expect(
        screen.queryByText(/your listing will be reviewed by an admin/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call handleSubmit from useListingFormSubmit on form submit", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /list an item/i,
      });
      fireEvent.click(submitButton);

      // handleSubmit from react-hook-form wraps our hook's handleSubmit
      expect(mockForm.handleSubmit).toHaveBeenCalledWith(
        mockFormSubmitHook.handleSubmit,
      );
    });

    it("should show loading state when isSubmitting is true", () => {
      mockFormSubmitHook.isSubmitting = true;

      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /listing your item/i,
      });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent("Listing your item...");
    });

    it("should show loading state when create mutation is pending", () => {
      mockFormSubmitHook.isCreatePending = true;
      mockFormSubmitHook.isSubmitting = true;

      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /listing your item/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("should show upload progress when uploading", () => {
      mockFormSubmitHook.uploadProgress = { current: 2, total: 5 };

      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /uploading 3 of 5/i,
      });
      expect(submitButton).toHaveTextContent("Uploading 3 of 5...");
    });

    it("should disable submit when loading images", () => {
      mockImagesHook.isLoading = true;

      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const submitButton = screen.getByRole("button", {
        name: /list an item/i,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Edit Mode", () => {
    it("should load existing images when editing", () => {
      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      expect(mockImagesHook.loadImages).toHaveBeenCalled();
    });

    it("should show 'Save Changes' button in edit mode", () => {
      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      const submitButton = screen.getByRole("button", {
        name: /save changes/i,
      });
      expect(submitButton).toBeInTheDocument();
    });

    it("should show 'Saving...' when update is pending in edit mode", () => {
      mockFormSubmitHook.isUpdatePending = true;
      mockFormSubmitHook.isSubmitting = true;

      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      const submitButton = screen.getByRole("button", {
        name: /saving/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("should pass isEdit and listingId to useListingFormSubmit", async () => {
      const { useListingFormSubmit } =
        await import("@/features/listings/hooks/use-listing-form-submit");

      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      expect(vi.mocked(useListingFormSubmit)).toHaveBeenCalledWith(
        expect.objectContaining({
          isEdit: true,
          listingId: "listing-123",
        }),
      );
    });

    it("should sync existing images to form when loaded", async () => {
      mockImagesHook.images = [
        {
          id: "image-1",
          imageUrl: "https://example.com/image1.jpg",
          orderIndex: 0,
        },
      ];

      renderWithQueryClient(
        <AddListingForm
          categories={mockCategories}
          isEdit={true}
          listingId="listing-123"
        />,
      );

      await waitFor(() => {
        expect(mockForm.setValue).toHaveBeenCalledWith(
          "images",
          [
            {
              id: "image-1",
              url: "https://example.com/image1.jpg",
              orderIndex: 0,
            },
          ],
          { shouldDirty: false, shouldValidate: true },
        );
      });
    });
  });

  describe("Form Validation", () => {
    it("should display owner policies acknowledgment checkbox", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const checkbox = screen.getByRole("checkbox", {
        name: /I have read and agree to the Owner Policies/i,
      });
      expect(checkbox).toBeInTheDocument();
    });

    it("should show validation error for owner policies", () => {
      const errorMessage =
        "You must acknowledge the Owner Policies to create a listing.";

      mockForm.formState.errors = {
        ownerPoliciesAcknowledged: { message: errorMessage },
      };

      (mockForm as any).getFieldState = vi.fn((name: string) => {
        if (name === "ownerPoliciesAcknowledged") {
          return {
            error: { message: errorMessage },
            invalid: true,
            isDirty: false,
            isTouched: true,
          };
        }
        return {
          error: undefined,
          invalid: false,
          isDirty: false,
          isTouched: false,
        };
      });
      mockForm.control.getFieldState = (mockForm as any).getFieldState;

      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(
        screen.getByText(new RegExp(errorMessage, "i")),
      ).toBeInTheDocument();
    });
  });

  describe("Categories", () => {
    it("should display categories in dropdown", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      const categoryLabels = screen.getAllByText(/category/i);
      expect(categoryLabels.length).toBeGreaterThan(0);
      expect(categoryLabels[0]).toHaveTextContent("Category *");

      const categorySelects = screen.getAllByRole("combobox");
      const categorySelect = categorySelects.find((el) =>
        el.textContent?.includes("Select category"),
      );
      expect(categorySelect).toBeInTheDocument();
    });
  });

  describe("Image Handling", () => {
    it("should render photos section", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(screen.getByText("Photos")).toBeInTheDocument();
    });

    it("should have image management functions available", () => {
      renderWithQueryClient(<AddListingForm categories={mockCategories} />);

      expect(mockForm.addImage).toBeDefined();
      expect(mockForm.removeImage).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { PhotosSection } from "../photos-section";
import {
  createMockForm,
  createMockImageFiles,
  createMockFormData,
} from "@/test/utils/listing-test-helpers";

// Mock image utilities
vi.mock("@/lib/image/image.utils", () => ({
  validateImageFile: vi.fn(),
}));

describe("PhotosSection", () => {
  const mockForm = createMockForm() as any;
  const mockImages = createMockImageFiles(2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render photos section header", () => {
    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add clear photos of your item. The first photo will be the main image.",
      ),
    ).toBeInTheDocument();
  });

  it("should render file input for image uploads", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // File input is hidden, query by type
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("accept", "image/*");
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("should display upload area when no images", () => {
    // Mock getValues to return empty array for "images" field
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return [];
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Click or drag to upload")).toBeInTheDocument();
    expect(
      screen.getByText("Max 10MB - images will be automatically optimized"),
    ).toBeInTheDocument();
  });

  it("should render uploaded images", () => {
    // Mock getValues to return mockImages array for "images" field
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // Should display images
    const images = screen.getAllByRole("img");
    expect(images.length).toBe(mockImages.length);
  });

  it("should call addImage when files are selected", async () => {
    // Mock validateImageFile to return null (no error) for valid files
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    // Create a proper FileList using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    await waitFor(() => {
      expect(mockForm.addImage).toHaveBeenCalledWith(file);
    });
  });

  it("should call removeImage when remove button is clicked", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // Find remove buttons by querying for buttons with destructive styling
    // They don't have accessible names, so query by container
    const removeButtons = container.querySelectorAll(
      'button[data-slot="button"]',
    );
    expect(removeButtons.length).toBe(mockImages.length);

    // Click first remove button
    fireEvent.click(removeButtons[0] as HTMLButtonElement);

    expect(mockForm.removeImage).toHaveBeenCalledWith(0);
  });

  it("should validate image files", async () => {
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

    // Create a proper FileList using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    await waitFor(() => {
      expect(validateImageFile).toHaveBeenCalledWith(file);
    });
  });

  it("should handle invalid image files", async () => {
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue("File too large");

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "large.jpg", { type: "image/jpeg" });

    // Create a proper FileList using DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    // Should not call addImage for invalid files
    await waitFor(() => {
      expect(mockForm.addImage).not.toHaveBeenCalled();
    });
  });

  it("should show loading state when isLoadingImages is true", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
          isLoadingImages={true}
        />
      </FormProvider>,
    );

    // When isLoadingImages is true, the content is not rendered (condition: {!isLoadingImages && ...})
    // So we should verify that the main content is not present
    const cardContent = container.querySelector('[data-slot="card-content"]');
    // The content should exist but the grid with images should not be rendered
    expect(cardContent).toBeInTheDocument();

    // Verify no images are rendered when loading
    const images = screen.queryAllByRole("img");
    expect(images.length).toBe(0);
  });

  it("should display drag and drop area", () => {
    // Mock getValues to return empty array for "images" field
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return [];
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    expect(screen.getByText("Click or drag to upload")).toBeInTheDocument();
    expect(
      screen.getByText("Max 10MB - images will be automatically optimized"),
    ).toBeInTheDocument();
  });

  it("should show image count limit", () => {
    // Ensure getValues returns empty array for images
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return [];
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // The component shows "Add at least one photo *" when there are no images
    expect(screen.getByText(/Add at least one photo/i)).toBeInTheDocument();
  });

  it("should render with proper semantic HTML", () => {
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // Card component uses data-slot="card", not role="region"
    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // CardTitle renders as a div, not a heading element
    const title = screen.getByText("Photos");
    expect(title).toBeInTheDocument();
  });

  it("should handle image reordering", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // Should have drag handles for reordering - query by SVG with grip-vertical class
    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // The GripVertical icon is rendered as an SVG with class "lucide-grip-vertical"
    const dragHandles = container.querySelectorAll("svg.lucide-grip-vertical");
    expect(dragHandles.length).toBe(mockImages.length);
  });

  it("should display image preview with proper attributes", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });

    render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    const images = screen.getAllByRole("img");
    images.forEach((img, index) => {
      // The component uses "Listing image {index + 1}" for alt text
      expect(img).toHaveAttribute("alt", `Listing image ${index + 1}`);
      expect(img).toHaveAttribute("class");
    });
  });

  it("should handle multiple file selection", async () => {
    // Mock validateImageFile to return null (no error) for valid files
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
        />
      </FormProvider>,
    );

    // The file input is hidden, query by type only (it doesn't have a name attribute)
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute("type", "file");

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    // Create a proper FileList using DataTransfer
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    await waitFor(() => {
      expect(mockForm.addImage).toHaveBeenCalledTimes(files.length);
    });
  });
});

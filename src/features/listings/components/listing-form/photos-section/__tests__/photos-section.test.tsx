import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider, useWatch } from "react-hook-form";
import { PhotosSection } from "../photos-section";

vi.mock("react-hook-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hook-form")>();
  return {
    ...actual,
    useWatch: vi.fn().mockReturnValue([]),
  };
});
import {
  createMockForm,
  createMockImageFiles,
  createMockFormData,
} from "@/test/utils/listing-test-helpers";

// Mock image utilities
vi.mock("@/lib/image/image.utils", () => ({
  validateImageFile: vi.fn(),
  isHeicFile: vi.fn().mockReturnValue(false),
  convertHeicToJpeg: vi.fn(),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    p: ({ children, ...props }: any) => {
      const { ...rest } = props;
      return <p {...rest}>{children}</p>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock @dnd-kit for tests
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  TouchSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <>{children}</>,
  rectSortingStrategy: {},
  arrayMove: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

describe("PhotosSection", () => {
  const mockForm = createMockForm() as any;
  const mockImages = createMockImageFiles(2);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWatch).mockReturnValue([]);
  });

  const renderPhotosSection = (overrides: Record<string, any> = {}) => {
    return render(
      <FormProvider {...(mockForm as any)}>
        <PhotosSection
          control={mockForm.control as any}
          getValues={mockForm.getValues as any}
          addImage={mockForm.addImage}
          removeImage={mockForm.removeImage}
          setImages={mockForm.setImages}
          {...overrides}
        />
      </FormProvider>,
    );
  };

  it("should render photos section header", () => {
    renderPhotosSection();

    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add clear photos of your item. The first photo will be the main image.",
      ),
    ).toBeInTheDocument();
  });

  it("should render file input for image uploads", () => {
    const { container } = renderPhotosSection();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute(
      "accept",
      ".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.heic,.heif",
    );
    expect(fileInput).toHaveAttribute("multiple");
  });

  it("should display clean empty state when no images", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return [];
      return createMockFormData();
    });

    renderPhotosSection();

    expect(screen.getByText("Add photos of your item")).toBeInTheDocument();
    expect(screen.getByText(/Upload up to 10 photos/)).toBeInTheDocument();
    expect(screen.getByText("Choose Photos")).toBeInTheDocument();
  });

  it("should render uploaded images", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    renderPhotosSection();

    const images = screen.getAllByRole("img");
    expect(images.length).toBe(mockImages.length);
  });

  it("should show photo count indicator when images exist", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    renderPhotosSection();

    expect(screen.getByText("2 of 10 photos")).toBeInTheDocument();
  });

  it("should call addImage when files are selected", async () => {
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = renderPhotosSection();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

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
    vi.mocked(useWatch).mockReturnValue(mockImages);

    const { container } = renderPhotosSection();

    const removeButtons = container.querySelectorAll(
      'button[aria-label^="Remove image"]',
    );
    expect(removeButtons.length).toBe(mockImages.length);

    fireEvent.click(removeButtons[0] as HTMLButtonElement);

    expect(mockForm.removeImage).toHaveBeenCalledWith(0);
  });

  it("should validate image files", async () => {
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = renderPhotosSection();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

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

    const { container } = renderPhotosSection();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["test"], "large.jpg", { type: "image/jpeg" });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    await waitFor(() => {
      expect(mockForm.addImage).not.toHaveBeenCalled();
    });
  });

  it("should show loading state when isLoadingImages is true", () => {
    const { container } = renderPhotosSection({ isLoadingImages: true });

    const cardContent = container.querySelector('[data-slot="card-content"]');
    expect(cardContent).toBeInTheDocument();

    const images = screen.queryAllByRole("img");
    expect(images.length).toBe(0);
  });

  it("should render with proper semantic HTML", () => {
    const { container } = renderPhotosSection();

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    const title = screen.getByText("Photos");
    expect(title).toBeInTheDocument();
  });

  it("should have drag handles for reordering", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    const { container } = renderPhotosSection();

    const dragHandles = container.querySelectorAll("svg.lucide-grip-vertical");
    expect(dragHandles.length).toBe(mockImages.length);
  });

  it("should display image preview with proper attributes", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    renderPhotosSection();

    const images = screen.getAllByRole("img");
    images.forEach((img, index) => {
      expect(img).toHaveAttribute("alt", `Listing image ${index + 1}`);
    });
  });

  it("should handle multiple file selection", async () => {
    const { validateImageFile } = await import("@/lib/image/image.utils");
    vi.mocked(validateImageFile).mockReturnValue(null);

    const { container } = renderPhotosSection();

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const files = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];

    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    const fileList = dataTransfer.files;

    fireEvent.change(fileInput, { target: { files: fileList } });

    await waitFor(() => {
      expect(mockForm.addImage).toHaveBeenCalledTimes(files.length);
    });
  });

  it("should show 'Main' badge on first image", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    renderPhotosSection();

    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("should show remaining slots in upload button", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    renderPhotosSection();

    expect(screen.getByText("8 remaining")).toBeInTheDocument();
  });

  it("should show remove buttons visible on mobile (not hidden behind hover)", () => {
    mockForm.getValues.mockImplementation((field?: string) => {
      if (field === "images") return mockImages;
      return createMockFormData();
    });
    vi.mocked(useWatch).mockReturnValue(mockImages);

    const { container } = renderPhotosSection();

    const removeButtons = container.querySelectorAll(
      'button[aria-label^="Remove image"]',
    );
    // Buttons should have opacity-60 (mobile visible) and sm:opacity-0 (desktop hover)
    removeButtons.forEach((btn) => {
      expect(btn.className).toContain("opacity-60");
      expect(btn.className).toContain("sm:opacity-0");
    });
  });
});

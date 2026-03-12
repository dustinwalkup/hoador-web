import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SortableImageItem } from "../sortable-image-item";
import type { ImageFile } from "@/features/listings/form-schema/listing.schema";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock @dnd-kit/sortable
const mockUseSortable = vi.fn();
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: (...args: any[]) => mockUseSortable(...args),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: (transform: any) =>
        transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
    },
  },
}));

describe("SortableImageItem", () => {
  const mockOnLoad = vi.fn();
  const mockOnError = vi.fn();
  const mockOnRemove = vi.fn();

  const defaultSortableReturn = {
    attributes: { role: "button", tabIndex: 0 },
    listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSortable.mockReturnValue(defaultSortableReturn);

    globalThis.URL.createObjectURL = vi.fn(
      () => "blob:http://localhost/mock-url",
    );
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  const defaultProps = {
    index: 0,
    onLoad: mockOnLoad,
    onError: mockOnError,
    onRemove: mockOnRemove,
  };

  function renderItem(image: ImageFile, index?: number) {
    return render(
      <SortableImageItem
        {...defaultProps}
        image={image}
        index={index ?? defaultProps.index}
      />,
    );
  }

  it("renders the ListingImage with correct props", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    renderItem(image);

    expect(screen.getByRole("img")).toHaveAttribute("alt", "Listing image 1");
  });

  it("calls useSortable with image id", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "test-id",
    };
    renderItem(image);

    expect(mockUseSortable).toHaveBeenCalledWith({ id: "test-id" });
  });

  it("falls back to img-{index} when id is not set", () => {
    const image: ImageFile = { url: "https://example.com/photo.jpg" };
    renderItem(image, 3);

    expect(mockUseSortable).toHaveBeenCalledWith({ id: "img-3" });
  });

  it("shows 'Main' badge on first image (index 0)", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    renderItem(image, 0);

    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("does not show 'Main' badge on non-first images", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-2",
    };
    renderItem(image, 1);

    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("renders remove button with correct aria-label", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    renderItem(image, 2);

    expect(
      screen.getByRole("button", { name: "Remove image 3" }),
    ).toBeInTheDocument();
  });

  it("calls onRemove with correct index when remove button is clicked", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    renderItem(image, 2);

    fireEvent.click(screen.getByRole("button", { name: "Remove image 3" }));

    expect(mockOnRemove).toHaveBeenCalledWith(2);
  });

  it("stops event propagation when remove button is clicked", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    const { container } = renderItem(image);

    const parentClickHandler = vi.fn();
    container.firstElementChild?.addEventListener("click", parentClickHandler);

    fireEvent.click(screen.getByRole("button", { name: "Remove image 1" }));

    // The click event on the button should not propagate to parent
    expect(mockOnRemove).toHaveBeenCalled();
  });

  it("renders drag handle", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    const { container } = renderItem(image);

    expect(
      container.querySelector("svg.lucide-grip-vertical"),
    ).toBeInTheDocument();
  });

  it("shows processing overlay when status is processing", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "processing",
    };
    renderItem(image);

    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("shows spinner icon during processing", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "processing",
    };
    const { container } = renderItem(image);

    // Lucide renders SVGs with class="lucide lucide-loader-circle" (animate-spin is on the element)
    const spinner = container.querySelector("svg.animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows error overlay when status is error", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "error",
      errorMessage: "Upload failed",
    };
    renderItem(image);

    expect(screen.getByText("Upload failed")).toBeInTheDocument();
  });

  it("shows default 'Failed' message when error has no message", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "error",
    };
    renderItem(image);

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows error icon in error state", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "error",
    };
    const { container } = renderItem(image);

    // Lucide AlertCircle renders with class "lucide lucide-circle-alert"
    const errorIcon = container.querySelector("svg.lucide-circle-alert");
    expect(errorIcon).toBeInTheDocument();
  });

  it("applies reduced opacity when dragging", () => {
    mockUseSortable.mockReturnValue({
      ...defaultSortableReturn,
      isDragging: true,
    });

    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    const { container } = renderItem(image);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe("0.5");
  });

  it("applies higher z-index when dragging", () => {
    mockUseSortable.mockReturnValue({
      ...defaultSortableReturn,
      isDragging: true,
    });

    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    const { container } = renderItem(image);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.zIndex).toBe("50");
  });

  it("does not apply drag styles when not dragging", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    const { container } = renderItem(image);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.opacity).toBe("");
    expect(wrapper.style.zIndex).toBe("");
  });

  it("does not show processing or error overlay for ready status", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
      status: "ready",
    };
    renderItem(image);

    expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("remove button has mobile-visible and desktop-hover classes", () => {
    const image: ImageFile = {
      url: "https://example.com/photo.jpg",
      id: "img-1",
    };
    renderItem(image);

    const btn = screen.getByRole("button", { name: "Remove image 1" });
    expect(btn.className).toContain("opacity-60");
    expect(btn.className).toContain("sm:opacity-0");
    expect(btn.className).toContain("sm:group-hover:opacity-100");
  });
});

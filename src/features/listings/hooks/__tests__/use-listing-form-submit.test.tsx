import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useListingFormSubmit } from "../use-listing-form-submit";
import type { ListingImage } from "../use-listing-images";
import { createMockFormData } from "@/test/utils/listing-test-helpers";

// Mock dependencies
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from "sonner";

// ─── XMLHttpRequest mock (hook uses XHR, not fetch) ──────────────────────
type XHRQueueEntry = { status: number; responseText: string; error?: boolean };
const xhrQueue: XHRQueueEntry[] = [];

class MockXHR {
  upload = { onprogress: null as (() => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 200;
  responseText = "";
  open = vi.fn();
  send = vi.fn(() => {
    const entry = xhrQueue.shift();
    if (!entry) return;
    Promise.resolve().then(() => {
      this.status = entry.status;
      this.responseText = entry.responseText;
      if (entry.error) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  });
}
vi.stubGlobal("XMLHttpRequest", MockXHR);
// ─────────────────────────────────────────────────────────────────────────

// Mock mutations
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock("../use-listing-mutations", () => ({
  useCreateListing: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateListing: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useListingFormSubmit", () => {
  const mockDeleteImage = vi.fn();
  const mockReorderImages = vi.fn().mockResolvedValue(undefined);
  const mockOnSuccess = vi.fn();

  const mockExistingImages: ListingImage[] = [
    {
      id: "img-1",
      listingId: "listing-123",
      imageUrl: "https://example.com/img1.jpg",
      blobPathname: "img1.jpg",
      orderIndex: 0,
      createdAt: new Date(),
    },
  ];

  const defaultOptions = {
    isEdit: false,
    listingId: undefined,
    existingImages: [] as ListingImage[],
    deleteImage: mockDeleteImage,
    reorderImages: mockReorderImages,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    xhrQueue.length = 0;
    // Default: seed enough success responses for any test that uploads images
    let uploadCounter = 0;
    for (let i = 0; i < 10; i++) {
      const id = `uploaded-${++uploadCounter}`;
      xhrQueue.push({
        status: 200,
        responseText: JSON.stringify({ success: true, image: { id } }),
      });
    }
  });

  it("should initialize with default state", () => {
    const { result } = renderHook(() => useListingFormSubmit(defaultOptions), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.uploadProgress).toBeNull();
  });

  describe("create mode", () => {
    it("should show error when no images provided", async () => {
      const { result } = renderHook(
        () => useListingFormSubmit(defaultOptions),
        { wrapper: createWrapper() },
      );

      const formData = createMockFormData();
      formData.images = [];

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Please add at least one image.",
      );
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it("should create listing and upload images on success", async () => {
      mockCreateMutateAsync.mockResolvedValue({ listingId: "new-listing-123" });

      const { result } = renderHook(
        () => useListingFormSubmit(defaultOptions),
        { wrapper: createWrapper() },
      );

      const formData = createMockFormData();

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(mockCreateMutateAsync).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Listing and images uploaded successfully!",
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard/listings/rentals");
    });

    it("should handle missing listingId from create response", async () => {
      mockCreateMutateAsync.mockResolvedValue({});

      const { result } = renderHook(
        () => useListingFormSubmit(defaultOptions),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(toast.error).toHaveBeenCalledWith(
        "An unexpected error occurred. Please try again.",
      );
    });

    it("should redirect to edit page on total upload failure", async () => {
      mockCreateMutateAsync.mockResolvedValue({
        listingId: "new-listing-123",
      });
      // Override queue with failure responses
      xhrQueue.length = 0;
      for (let i = 0; i < 10; i++) {
        xhrQueue.push({
          status: 500,
          responseText: JSON.stringify({ error: "Upload failed" }),
        });
      }

      const { result } = renderHook(
        () => useListingFormSubmit(defaultOptions),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Images failed to upload. Redirecting to edit your listing...",
      );
      expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/listings/new-listing-123/edit",
      );
    });
  });

  describe("edit mode", () => {
    const editOptions = {
      ...defaultOptions,
      isEdit: true,
      listingId: "listing-123",
      existingImages: mockExistingImages,
    };

    it("should show error when no existing or new images in edit mode", async () => {
      const { result } = renderHook(
        () =>
          useListingFormSubmit({
            ...editOptions,
            existingImages: [],
          }),
        { wrapper: createWrapper() },
      );

      const formData = createMockFormData();
      formData.images = [{ url: "https://example.com/old.jpg", orderIndex: 0 }]; // no file

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Please add at least one image.",
      );
    });

    it("should update listing and delete removed images", async () => {
      mockUpdateMutateAsync.mockResolvedValue({ success: true });
      mockDeleteImage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useListingFormSubmit(editOptions), {
        wrapper: createWrapper(),
      });

      // Submit with no images referencing existing img-1 (simulating removal)
      const formData = createMockFormData();
      formData.images = [
        {
          file: new File(["new"], "new.jpg", { type: "image/jpeg" }),
          orderIndex: 0,
        },
      ];

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        listingId: "listing-123",
        data: expect.objectContaining({ name: formData.name }),
      });
      expect(mockDeleteImage).toHaveBeenCalledWith("img-1", { silent: true });
      expect(mockPush).toHaveBeenCalledWith("/dashboard/listings/rentals");
    });

    it("should allow edit with only existing images (no new uploads)", async () => {
      mockUpdateMutateAsync.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useListingFormSubmit(editOptions), {
        wrapper: createWrapper(),
      });

      const formData = createMockFormData();
      // Keep the existing image reference
      formData.images = [
        { id: "img-1", url: "https://example.com/img1.jpg", orderIndex: 0 },
      ];

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalled();
      // No new images to upload, so fetch should not be called for upload
      expect(mockPush).toHaveBeenCalledWith("/dashboard/listings/rentals");
    });
  });

  it("should handle mutation errors gracefully", async () => {
    mockCreateMutateAsync.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useListingFormSubmit(defaultOptions), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleSubmit(createMockFormData());
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});

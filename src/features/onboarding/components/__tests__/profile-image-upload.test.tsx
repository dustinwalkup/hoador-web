import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileImageUpload } from "../profile-image-upload";

// Mock profile upload utilities
const mockUploadProfileImage = vi.fn();
const mockDeleteProfileImage = vi.fn();

vi.mock("@/lib/utils/profile-upload", () => ({
  uploadProfileImage: (file: File) => mockUploadProfileImage(file),
  deleteProfileImage: (pathname: string) => mockDeleteProfileImage(pathname),
}));

// Mock toast
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (message: string) => mockToastError(message),
    success: (message: string) => mockToastSuccess(message),
  },
}));

// Mock Next.js Image
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

describe("ProfileImageUpload", () => {
  const mockOnImageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadProfileImage.mockResolvedValue({
      url: "https://example.com/uploaded-image.jpg",
    });
    mockDeleteProfileImage.mockResolvedValue({ success: true });
  });

  describe("Rendering", () => {
    it("should render upload area with drag-and-drop zone", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const uploadArea = screen.getByText(/drag and drop or click to browse/i);
      expect(uploadArea).toBeInTheDocument();
    });

    it("should show user initials when no image", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
      expect(screen.getByText(/add photo/i)).toBeInTheDocument();
    });

    it("should show current image when provided", () => {
      render(
        <ProfileImageUpload
          currentImageUrl="https://example.com/image.jpg"
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const image = screen.getByAltText("Profile");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
    });

    it("should show upload icon when no image and no initials", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials=""
        />,
      );

      expect(screen.getByText(/upload photo/i)).toBeInTheDocument();
    });
  });

  describe("User interaction", () => {
    it("should trigger upload when file is selected", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      // Create FileList using DataTransfer
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(mockUploadProfileImage).toHaveBeenCalledWith(file);
      });
    });

    it("should trigger upload on drag and drop", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const uploadArea = container.querySelector(
        '[class*="border-dashed"]',
      ) as HTMLElement;

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      // Create a proper DataTransfer object
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Use fireEvent.drop with dataTransfer
      fireEvent.drop(uploadArea, {
        dataTransfer,
      });

      await waitFor(() => {
        expect(mockUploadProfileImage).toHaveBeenCalledWith(file);
      });
    });

    it("should open file picker when clicked", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const uploadArea = container.querySelector(
        '[class*="border-dashed"]',
      ) as HTMLElement;

      fireEvent.click(uploadArea);

      expect(clickSpy).toHaveBeenCalled();
    });

    it("should remove image when remove button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <ProfileImageUpload
          currentImageUrl="https://example.com/profiles/user-123/image.jpg"
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const removeButton = screen.getByRole("button", { name: "" }); // X button
      await user.click(removeButton);

      await waitFor(() => {
        expect(mockOnImageChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Validation", () => {
    it("should reject invalid file types", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(mockOnImageChange).not.toHaveBeenCalled();
        expect(screen.getByText(/valid image file/i)).toBeInTheDocument();
      });
    });

    it("should reject files over 5MB", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      // Create a file larger than 5MB
      const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(largeFile);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(mockOnImageChange).not.toHaveBeenCalled();
        expect(screen.getByText(/smaller than 5MB/i)).toBeInTheDocument();
      });
    });

    it("should show error message for validation failures", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const invalidFile = new File(["test"], "test.txt", {
        type: "text/plain",
      });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(invalidFile);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(screen.getByText(/valid image file/i)).toBeInTheDocument();
      });
    });

    it("should show error message for upload failures", async () => {
      mockUploadProfileImage.mockRejectedValue(new Error("Upload failed"));

      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        // The component shows two "upload failed" texts:
        // 1. "Upload Failed" (span) in the upload area
        // 2. "Upload failed" (paragraph) in the error message area
        // We want to verify the error message paragraph exists
        const errorMessages = screen.getAllByText(/upload failed/i);
        expect(errorMessages.length).toBeGreaterThanOrEqual(1);
        // Verify the error message paragraph (not the span) exists
        const errorParagraph = errorMessages.find(
          (el) => el.tagName === "P" && el.textContent === "Upload failed",
        );
        expect(errorParagraph).toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("should show spinner during upload", async () => {
      // Make upload take some time
      mockUploadProfileImage.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ url: "test.jpg" }), 100),
          ),
      );

      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      // Should show loading spinner
      await waitFor(() => {
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeInTheDocument();
      });
    });

    it("should disable interaction during upload", async () => {
      mockUploadProfileImage.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ url: "test.jpg" }), 100),
          ),
      );

      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      // Upload area should be disabled during upload
      await waitFor(() => {
        const uploadArea = container.querySelector('[class*="border-dashed"]');
        expect(uploadArea).toHaveClass("opacity-50");
      });
    });
  });

  describe("Error handling", () => {
    it("should show retry button on upload error", async () => {
      mockUploadProfileImage.mockRejectedValue(new Error("Upload failed"));

      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it("should trigger file picker when retry button is clicked", async () => {
      const user = userEvent.setup();
      mockUploadProfileImage.mockRejectedValue(new Error("Upload failed"));

      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      fireEvent.change(fileInput, { target: { files: fileList } });

      await waitFor(() => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/try again/i);
      const clickSpy = vi.spyOn(fileInput, "click");

      await user.click(retryButton);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("Props", () => {
    it("should respect disabled prop", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
          disabled={true}
        />,
      );

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).toBeDisabled();
    });

    it("should respect showRemoveButton prop", () => {
      render(
        <ProfileImageUpload
          currentImageUrl="https://example.com/image.jpg"
          onImageChange={mockOnImageChange}
          userInitials="JD"
          showRemoveButton={false}
        />,
      );

      // Remove button should not be visible
      const removeButtons = screen.queryAllByRole("button");
      expect(removeButtons.length).toBe(0);
    });

    it("should respect showToasts prop", async () => {
      const { container } = render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
          showToasts={false}
        />,
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      // Record initial call count to handle any stray calls from previous tests' pending async operations
      const initialToastCallCount = mockToastSuccess.mock.calls.length;

      fireEvent.change(fileInput, { target: { files: fileList } });

      // Wait for upload to complete and onImageChange to be called
      await waitFor(() => {
        expect(mockUploadProfileImage).toHaveBeenCalled();
        expect(mockOnImageChange).toHaveBeenCalled();
      });

      // Wait for loading state to clear, ensuring all async operations complete
      // This includes waiting for the toast check (if any) to complete
      await waitFor(
        () => {
          const spinner = container.querySelector(".animate-spin");
          expect(spinner).not.toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      // Wait for toast count to be stable - ensures all async operations and microtasks are complete
      // This handles race conditions in CI where timing can vary
      await waitFor(
        () => {
          const currentCount = mockToastSuccess.mock.calls.length;
          expect(currentCount).toBe(initialToastCallCount);
        },
        {
          timeout: 500,
          interval: 10, // Check every 10ms to catch any delayed calls
        },
      );

      // Final assertion - toast should not have been called any additional times when showToasts is false
      expect(mockToastSuccess.mock.calls.length).toBe(initialToastCallCount);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing currentImageUrl", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials="JD"
        />,
      );

      // Should show initials instead
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("should handle empty userInitials", () => {
      render(
        <ProfileImageUpload
          onImageChange={mockOnImageChange}
          userInitials=""
        />,
      );

      // Should show upload icon
      expect(screen.getByText(/upload photo/i)).toBeInTheDocument();
    });
  });
});

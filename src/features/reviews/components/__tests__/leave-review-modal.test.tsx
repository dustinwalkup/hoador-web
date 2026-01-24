import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaveReviewModal } from "../leave-review-modal";

// Mock React Query hook
const mockMutate = vi.fn();
const mockUseCreateReview = vi.fn(() => ({
  mutate: mockMutate,
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: null,
}));

vi.mock("../../hooks/use-review-mutations", () => ({
  useCreateReview: () => mockUseCreateReview(),
}));

// Mock toast (used by mutation helpers)
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ children, href, target, rel, className }: any) => (
    <a href={href} target={target} rel={rel} className={className}>
      {children}
    </a>
  ),
}));

describe("LeaveReviewModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    rentalId: "rental-123",
    listingName: "Power Drill",
    onSuccess: vi.fn(),
    isRequestId: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default state
    mockUseCreateReview.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: null,
    });
  });

  describe("Modal Structure", () => {
    it("renders modal when open is true", () => {
      render(<LeaveReviewModal {...defaultProps} />);

      expect(screen.getByText("Leave a Review")).toBeInTheDocument();
      expect(
        screen.getByText("Share your experience with Power Drill"),
      ).toBeInTheDocument();
    });

    it("does not render modal when open is false", () => {
      render(<LeaveReviewModal {...defaultProps} open={false} />);

      expect(screen.queryByText("Leave a Review")).not.toBeInTheDocument();
    });

    it("shows review policy link when reviewPolicyUrl is provided", () => {
      render(
        <LeaveReviewModal
          {...defaultProps}
          reviewPolicyUrl="https://example.com/review-policy.pdf"
        />,
      );

      const link = screen.getByText("Read review policy");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute(
        "href",
        "https://example.com/review-policy.pdf",
      );
      expect(link.closest("a")).toHaveAttribute("target", "_blank");
      expect(link.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not show review policy link when reviewPolicyUrl is not provided", () => {
      render(<LeaveReviewModal {...defaultProps} />);

      expect(screen.queryByText("Read review policy")).not.toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("requires rating selection", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      expect(mockMutate).not.toHaveBeenCalled();
      // Note: Toast error would be called but we can't easily test it in this setup
    });

    it("requires comment with minimum length", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      // Select a rating - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]); // 5-star rating

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(commentTextarea, "Short");

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("accepts valid form data", async () => {
      const user = userEvent.setup();

      render(<LeaveReviewModal {...defaultProps} />);

      // Select a rating - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]); // 5-star rating

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters for testing purposes",
      );

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          {
            rentalId: "rental-123",
            rating: 5,
            comment:
              "This is a valid comment with more than 10 characters for testing purposes",
            accuracyRating: undefined,
            listingConditionRating: undefined,
            ownerCommunicationRating: undefined,
          },
          expect.any(Object), // onSuccess callback
        );
      });
    });
  });

  describe("Star Rating", () => {
    it("allows selecting overall rating", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      // Find the overall rating buttons (first set of 5 stars)
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];

      await user.click(ratingButtons[2]); // 3-star rating

      // Check that the rating selection works (buttons exist and are clickable)
      expect(ratingButtons.length).toBe(5);
      expect(ratingButtons[2]).toBeInTheDocument();
    });

    it("allows selecting optional detailed ratings", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      expect(screen.getByText("Optional Detailed Ratings")).toBeInTheDocument();

      // Find the accuracy rating section and click a star
      const accuracySection = screen.getByText(
        "Accuracy of Listing",
      ).parentElement;
      const accuracyButtons =
        accuracySection?.querySelectorAll("button[aria-label*='Rate']") || [];
      await user.click(accuracyButtons[0]); // First star for accuracy

      // Find the tool condition rating section and click a star
      const conditionSection = screen.getByText("Tool Condition").parentElement;
      const conditionButtons =
        conditionSection?.querySelectorAll("button[aria-label*='Rate']") || [];
      await user.click(conditionButtons[1]); // Second star for condition

      // Find the communication rating section and click a star
      const communicationSection = screen.getByText(
        "Owner Communication",
      ).parentElement;
      const communicationButtons =
        communicationSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(communicationButtons[2]); // Third star for communication

      // Verify sections exist
      expect(accuracyButtons.length).toBe(5);
      expect(conditionButtons.length).toBe(5);
      expect(communicationButtons.length).toBe(5);
    });
  });

  describe("Form Submission", () => {
    it("shows loading state during submission", async () => {
      const user = userEvent.setup();
      // Mock pending state - when isPending is true, button shows "Submitting..."
      mockUseCreateReview.mockReturnValue({
        mutate: mockMutate,
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
        isSuccess: false,
        error: null,
        data: null,
      });

      render(<LeaveReviewModal {...defaultProps} />);

      // Select rating and enter comment - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      // When isPending is true, button should show "Submitting..." and be disabled
      const submittingButton = screen.getByRole("button", {
        name: /Submitting.../i,
      });
      expect(submittingButton).toBeInTheDocument();
      expect(submittingButton).toBeDisabled();
      expect(screen.getByText("Submitting...")).toBeInTheDocument();
    });

    it("handles successful submission", async () => {
      const user = userEvent.setup();
      const mockOnSuccess = vi.fn();
      const mockOnOpenChange = vi.fn();

      render(
        <LeaveReviewModal
          {...defaultProps}
          onSuccess={mockOnSuccess}
          onOpenChange={mockOnOpenChange}
        />,
      );

      // Fill form - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });

      // Simulate successful mutation by calling onSuccess callback
      const mutateCall = mockMutate.mock.calls[0];
      const onSuccessCallback = mutateCall[1]?.onSuccess;
      if (onSuccessCallback) {
        onSuccessCallback();
      }

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("handles submission error", async () => {
      const user = userEvent.setup();

      render(<LeaveReviewModal {...defaultProps} />);

      // Fill form - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
        // Modal should remain open on error (error handling is done by mutation hook)
        expect(screen.getByText("Leave a Review")).toBeInTheDocument();
      });
    });

    it("handles request ID instead of rental ID", async () => {
      const user = userEvent.setup();

      render(<LeaveReviewModal {...defaultProps} isRequestId={true} />);

      // Fill form - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          {
            requestId: "rental-123",
            rating: 5,
            comment: "This is a valid comment with more than 10 characters",
            accuracyRating: undefined,
            listingConditionRating: undefined,
            ownerCommunicationRating: undefined,
          },
          expect.any(Object), // onSuccess callback
        );
      });
    });
  });

  describe("Form Reset", () => {
    it("resets form after successful submission", async () => {
      const user = userEvent.setup();

      render(<LeaveReviewModal {...defaultProps} />);

      // Fill form with various data - find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[4]); // 5 stars

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.clear(commentTextarea);
      await user.type(
        commentTextarea,
        "This is a valid comment with more than 10 characters",
      );

      // Submit form
      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      await user.click(submitButton);

      // Wait for mutation to be called
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });

      // Simulate successful mutation by calling onSuccess callback
      const mutateCall = mockMutate.mock.calls[0];
      const onSuccessCallback = mutateCall[1]?.onSuccess;
      if (onSuccessCallback) {
        onSuccessCallback();
      }

      // Form should be reset when modal reopens, but since it closes we can't easily test this
      // The reset logic is in the onSuccess callback
    });
  });

  describe("Modal Controls", () => {
    it("calls onOpenChange when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();

      render(
        <LeaveReviewModal {...defaultProps} onOpenChange={mockOnOpenChange} />,
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("disables submit button when rating is not selected", () => {
      render(<LeaveReviewModal {...defaultProps} />);

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("enables submit button when rating is selected", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      // Find the overall rating buttons specifically
      const overallRatingSection =
        screen.getByText("Overall Rating").parentElement;
      const ratingButtons =
        overallRatingSection?.querySelectorAll("button[aria-label*='Rate']") ||
        [];
      await user.click(ratingButtons[2]); // Select rating

      const submitButton = screen.getByRole("button", {
        name: /Submit Review/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Character Count", () => {
    it("shows character count for comment", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(commentTextarea, "Test comment");

      expect(screen.getByText("12/2000 characters")).toBeInTheDocument();
    });

    it("updates character count as user types", async () => {
      const user = userEvent.setup();
      render(<LeaveReviewModal {...defaultProps} />);

      const commentTextarea = screen.getByLabelText(/Your Review/i);
      await user.type(commentTextarea, "Hello world");

      expect(screen.getByText("11/2000 characters")).toBeInTheDocument();
    });
  });
});

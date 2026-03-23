import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceReviewService } from "../services/service-review-service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/dal/errors";

const mockBookingGetById = vi.fn();
const mockListingGetById = vi.fn();
const mockReviewCreate = vi.fn();
const mockUpdateAggregate = vi.fn();

vi.mock("@/dal", () => ({
  serviceBookingDAL: { getById: (...a: unknown[]) => mockBookingGetById(...a) },
  serviceListingDAL: { getById: (...a: unknown[]) => mockListingGetById(...a) },
  serviceReviewDAL: {
    create: (...a: unknown[]) => mockReviewCreate(...a),
    updateProviderAggregateRating: (...a: unknown[]) =>
      mockUpdateAggregate(...a),
  },
}));

const completedBooking = {
  id: "book-1",
  status: "completed" as const,
  requesterId: "req-1",
  providerId: "prov-1",
  listingId: "list-1",
  listing: {} as never,
  requester: {} as never,
  provider: {} as never,
};

const listing = {
  id: "list-1",
  providerId: "prov-1",
  category: { id: "c", name: "n", description: null },
  provider: {} as never,
};

describe("ServiceReviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when booking is not completed", async () => {
    mockBookingGetById.mockResolvedValue({
      ...completedBooking,
      status: "accepted",
    });

    await expect(
      ServiceReviewService.submitReview("book-1", "req-1", { rating: 5 }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects when reviewer is neither requester nor provider", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);

    await expect(
      ServiceReviewService.submitReview("book-1", "stranger", { rating: 5 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects invalid rating", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);

    await expect(
      ServiceReviewService.submitReview("book-1", "req-1", { rating: 6 }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects rating below 1", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);

    await expect(
      ServiceReviewService.submitReview("book-1", "req-1", { rating: 0 }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects rating that rounds outside 1–5 (e.g. 5.6 → 6)", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);
    mockListingGetById.mockResolvedValue(listing);

    await expect(
      ServiceReviewService.submitReview("book-1", "req-1", { rating: 5.6 }),
    ).rejects.toThrow(ValidationError);
  });

  it("maps duplicate review to ConflictError", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);
    mockListingGetById.mockResolvedValue(listing);
    mockReviewCreate.mockRejectedValue(
      new ConflictError("A review for this booking already exists"),
    );

    await expect(
      ServiceReviewService.submitReview("book-1", "req-1", { rating: 4 }),
    ).rejects.toThrow(ConflictError);
  });

  it("creates review and refreshes aggregate rating", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);
    mockListingGetById.mockResolvedValue(listing);
    mockReviewCreate.mockResolvedValue({ id: "rev-1" });

    await ServiceReviewService.submitReview("book-1", "req-1", {
      rating: 5,
      comment: "great",
    });

    expect(mockReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book-1",
        reviewerId: "req-1",
        revieweeId: "prov-1",
        rating: 5,
      }),
    );
    expect(mockUpdateAggregate).toHaveBeenCalledWith("prov-1");
  });

  it("sets reviewee to requester when provider reviews", async () => {
    mockBookingGetById.mockResolvedValue(completedBooking);
    mockListingGetById.mockResolvedValue(listing);
    mockReviewCreate.mockResolvedValue({ id: "rev-2" });

    await ServiceReviewService.submitReview("book-1", "prov-1", { rating: 4 });

    expect(mockReviewCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerId: "prov-1",
        revieweeId: "req-1",
      }),
    );
  });

  it("throws NotFoundError when booking missing", async () => {
    mockBookingGetById.mockResolvedValue(null);

    await expect(
      ServiceReviewService.submitReview("missing", "req-1", { rating: 3 }),
    ).rejects.toThrow(NotFoundError);
  });
});

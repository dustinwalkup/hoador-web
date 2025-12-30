export const mockReview = {
  id: "review-123",
  listingId: "listing-123",
  renterId: "user-456",
  ownerId: "user-123",
  rating: 5,
  title: "Great tool!",
  comment: "This drill worked perfectly for my project. Highly recommend!",
  createdAt: new Date("2024-01-20"),
  reviewer: {
    id: "user-456",
    firstName: "Jane",
    lastName: "Smith",
    profileImageUrl: "https://example.com/jane.jpg",
  },
};

export const mockReviewMinimal = {
  listingId: "listing-123",
  renterId: "user-456",
  ownerId: "user-123",
  rating: 4,
  comment: "Good tool",
};

export const mockReviewInvalid = {
  listingId: "listing-123",
  renterId: "user-456",
  ownerId: "user-123",
  rating: 6, // Invalid: rating > 5
  comment: "x".repeat(2000), // Invalid: comment too long
};

export const mockReviewList = [
  mockReview,
  {
    ...mockReview,
    id: "review-124",
    rating: 4,
    title: "Good value",
    comment: "Works well for the price",
  },
  {
    ...mockReview,
    id: "review-125",
    rating: 3,
    title: "Okay",
    comment: "Could be better",
  },
];

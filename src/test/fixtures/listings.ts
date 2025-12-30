import type { ListingDetails } from "@/dal/types";

export const mockListing: ListingDetails = {
  id: "listing-123",
  name: "Test Power Drill",
  description: "A heavy-duty power drill for construction work",
  owner: {
    id: "user-123",
    firstName: "John",
    lastName: "Doe",
    profileImageUrl: "https://example.com/profile.jpg",
    averageRating: 4.5,
    reviewCount: 10,
    memberSince: new Date("2024-01-01"),
  },
  category: {
    id: "category-123",
    name: "Power Tools",
    icon: "drill",
  },
  dailyRate: 15.00,
  weeklyRate: 90.00,
  monthlyRate: 300.00,
  securityDeposit: 50.00,
  condition: "excellent",
  status: "available",
  specifications: {},
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "both_available",
  deliveryFee: 10.00,
  deliveryRadius: 25,
  setupAvailable: true,
  setupFee: 20.00,
  viewCount: 0,
  favoriteCount: 0,
  images: [
    {
      id: "image-1",
      imageUrl: "https://example.com/image1.jpg",
      orderIndex: 0,
    },
  ],
  reviews: [],
  availability: [],
  averageRating: 0,
  reviewCount: 0,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockListingMinimal: Partial<ListingDetails> = {
  id: "listing-minimal",
  name: "Minimal Listing",
  description: "Minimal description",
  dailyRate: 10.00,
  condition: "good",
  status: "available",
};

export const mockListingInvalid = {
  name: "", // Invalid: empty name
  description: "x".repeat(5000), // Invalid: too long
  dailyRate: "-10.00", // Invalid: negative price
  condition: "invalid-condition", // Invalid: not in enum
};

export const mockCategory = {
  id: "category-123",
  name: "Power Tools",
  description: "Electric power tools",
  icon: "drill",
};

export const mockOwner = {
  id: "user-123",
  firstName: "John",
  lastName: "Doe",
  profileImageUrl: "https://example.com/profile.jpg",
  createdAt: new Date("2024-01-01"),
};

export const mockRenter = {
  id: "user-456",
  firstName: "Jane",
  lastName: "Smith",
  profileImageUrl: "https://example.com/jane.jpg",
  createdAt: new Date("2024-01-02"),
};

export const mockListingImages = [
  {
    id: "image-1",
    listingId: "listing-123",
    imageUrl: "https://example.com/image1.jpg",
    orderIndex: 0,
  },
  {
    id: "image-2",
    listingId: "listing-123",
    imageUrl: "https://example.com/image2.jpg",
    orderIndex: 1,
  },
];


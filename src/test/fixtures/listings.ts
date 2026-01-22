import type { ListingDetails } from "@/dal/types";
import type { UserListing } from "@/dal/listing.dal";

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
  dailyRate: 15.0,
  weeklyRate: 90.0,
  monthlyRate: 300.0,
  securityDeposit: 50.0,
  condition: "excellent",
  status: "available",
  specifications: {},
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "both_available",
  deliveryFee: 10.0,
  deliveryRadius: 25,
  setupAvailable: true,
  setupFee: 20.0,
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
  dailyRate: 10.0,
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

export const mockListingWithImages: ListingDetails = {
  ...mockListing,
  images: mockListingImages,
};

export const mockListingActive: ListingDetails = {
  ...mockListing,
  id: "listing-active",
  status: "available",
};

export const mockListingInactive: ListingDetails = {
  ...mockListing,
  id: "listing-inactive",
  status: "maintenance",
};

export const mockListingArchived: ListingDetails = {
  ...mockListing,
  id: "listing-archived",
  status: "available",
};

export const mockCategories = [
  {
    id: "power-tools",
    name: "Power Tools",
    description: "Electric power tools",
    icon: "drill",
    isActive: true,
    sortOrder: 1,
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "hand-tools",
    name: "Hand Tools",
    description: "Manual hand tools",
    icon: "hammer",
    isActive: true,
    sortOrder: 2,
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "gardening",
    name: "Gardening",
    description: "Gardening tools and equipment",
    icon: "shovel",
    isActive: true,
    sortOrder: 3,
    parentId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

// Garage Listings (UserListing type for garage hooks)
export const mockGarageListingActive: UserListing = {
  id: "garage-active-1",
  name: "Power Drill",
  description: "Heavy duty power drill",
  ownerId: "user-123",
  categoryId: "power-tools",
  communityId: "community-1",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "excellent",
  status: "available",
  isActive: true,
  dailyRate: 15.99,
  weeklyRate: 90.0,
  monthlyRate: 300.0,
  securityDeposit: 50.0,
  deliveryFee: 10.0,
  setupFee: 25.0,
  specifications: { power: "20V MAX" },
  instructions: "Insert battery and use trigger",
  safetyNotes: "Wear safety glasses",
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "pickup_only",
  deliveryRadius: 10,
  setupAvailable: true,
  firstImageUrl: "https://example.com/drill.jpg",
  averageRating: 4.5,
  reviewCount: 10,
  viewCount: 0,
  favoriteCount: 0,
  approvalStatus: "approved",
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

export const mockGarageListingRented: UserListing = {
  ...mockGarageListingActive,
  id: "garage-rented-1",
  name: "Hammer",
  status: "rented",
  categoryId: "hand-tools",
  firstImageUrl: "https://example.com/hammer.jpg",
  averageRating: 4.2,
  reviewCount: 5,
};

export const mockGarageListingInactive: UserListing = {
  ...mockGarageListingActive,
  id: "garage-inactive-1",
  name: "Maintenance Drill",
  status: "maintenance",
  isActive: true,
  firstImageUrl: "https://example.com/drill-maintenance.jpg",
};

export const mockGarageListingArchived: UserListing = {
  ...mockGarageListingActive,
  id: "garage-archived-1",
  name: "Old Drill",
  status: "available",
  isActive: false,
  firstImageUrl: "https://example.com/old-drill.jpg",
};

export const mockGarageListings = [
  mockGarageListingActive,
  mockGarageListingRented,
  mockGarageListingInactive,
  mockGarageListingArchived,
];

// Explore Listings (with distance and rating data)
export const mockExploreListing: UserListing = {
  ...mockGarageListingActive,
  id: "explore-1",
  name: "Professional Power Drill",
  distanceMiles: 2.5,
  averageRating: 4.8,
  reviewCount: 25,
  createdAt: new Date("2024-01-10"),
};

export const mockExploreListingNearby: UserListing = {
  ...mockExploreListing,
  id: "explore-nearby",
  name: "Nearby Hammer",
  categoryId: "hand-tools",
  distanceMiles: 0.8,
  averageRating: 4.2,
  reviewCount: 8,
  firstImageUrl: "https://example.com/nearby-hammer.jpg",
};

export const mockExploreListingFar: UserListing = {
  ...mockExploreListing,
  id: "explore-far",
  name: "Far Away Saw",
  categoryId: "power-tools",
  distanceMiles: 15.3,
  averageRating: 3.9,
  reviewCount: 12,
  firstImageUrl: "https://example.com/far-saw.jpg",
};

export const mockExploreListingNew: UserListing = {
  ...mockExploreListing,
  id: "explore-new",
  name: "Brand New Drill",
  createdAt: new Date(), // Very recent - should be marked as "new"
  distanceMiles: 3.2,
  averageRating: 0,
  reviewCount: 0,
};

export const mockExploreListings = [
  mockExploreListing,
  mockExploreListingNearby,
  mockExploreListingFar,
  mockExploreListingNew,
];

// Filter Configurations
const basicListingFilters = {
  query: "",
  categoryId: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  condition: [] as string[],
  deliveryMode: "pickup_only" as const,
  setupAvailable: undefined,
  availableNow: undefined,
  sortBy: "newest" as const,
  sortOrder: "desc" as const,
  page: 1,
};

export const mockListingFilters = {
  basic: basicListingFilters,
  withSearch: {
    ...basicListingFilters,
    query: "drill",
  },
  withCategory: {
    ...basicListingFilters,
    categoryId: "power-tools",
  },
  withPriceRange: {
    ...basicListingFilters,
    minPrice: 10,
    maxPrice: 50,
  },
  withCondition: {
    ...basicListingFilters,
    condition: ["good", "excellent"],
  },
  withAllFilters: {
    query: "hammer",
    categoryId: "hand-tools",
    minPrice: 5,
    maxPrice: 25,
    condition: ["good"],
    deliveryMode: "delivery_only" as const,
    setupAvailable: true,
    availableNow: true,
    sortBy: "price" as const,
    sortOrder: "asc" as const,
    page: 1,
  },
};

const basicGarageFilters = {
  query: "",
  categoryId: undefined,
  sortBy: "newest" as const,
  sortOrder: "desc" as const,
  rentalStatus: undefined as "available" | "rented" | undefined,
};

export const mockGarageFilters = {
  basic: basicGarageFilters,
  withSearch: {
    ...basicGarageFilters,
    query: "drill",
  },
  withCategory: {
    ...basicGarageFilters,
    categoryId: "power-tools",
  },
  withRentalStatus: {
    ...basicGarageFilters,
    rentalStatus: "available" as const,
  },
  withAllFilters: {
    query: "hammer",
    categoryId: "hand-tools",
    sortBy: "name" as const,
    sortOrder: "asc" as const,
    rentalStatus: "rented" as const,
  },
};

// Paginated Responses
export const mockPaginatedResponse = {
  data: mockExploreListings,
  pagination: {
    page: 1,
    limit: 12,
    total: 25,
    totalPages: 3,
    hasNext: true,
    hasPrev: false,
  },
};

export const mockPaginatedResponseLastPage = {
  data: [mockExploreListingFar],
  pagination: {
    page: 3,
    limit: 12,
    total: 25,
    totalPages: 3,
    hasNext: false,
    hasPrev: true,
  },
};

export const mockEmptyPaginatedResponse = {
  data: [],
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
};

// Infinite Query Responses
export const mockInfiniteQueryResponse = {
  pages: [
    {
      data: [mockExploreListing, mockExploreListingNearby],
      pagination: { hasNext: true, totalPages: 3, currentPage: 1 },
    },
    {
      data: [mockExploreListingFar],
      pagination: { hasNext: false, totalPages: 3, currentPage: 2 },
    },
  ],
  pageParams: [1, 2],
};

// Form Data Fixtures
export const mockCreateListingFormData = {
  name: "Test Power Drill",
  description: "A heavy-duty power drill for construction work",
  categoryId: "power-tools",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "new" as const,
  dailyRate: 15.99,
  weeklyRate: 90.0,
  monthlyRate: 300.0,
  securityDeposit: 50.0,
  images: [
    {
      file: new File([""], "drill.jpg", { type: "image/jpeg" }),
      url: "https://example.com/drill.jpg",
      orderIndex: 0,
    },
  ],
  specifications: {
    power: "20V MAX",
    weight: "3.4 lbs",
  },
  instructions: "Insert battery and use trigger",
  safetyNotes: "Wear safety glasses",
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "both_available" as const,
  deliveryFee: 10.0,
  deliveryRadius: 10,
  setupAvailable: true,
  setupFee: 25.0,
};

export const mockMinimalCreateListingFormData = {
  name: "Hammer",
  description: "Basic hammer",
  categoryId: "hand-tools",
  condition: "good" as const,
  dailyRate: 5.0,
  securityDeposit: 0,
  images: [
    {
      file: new File([""], "hammer.jpg", { type: "image/jpeg" }),
      url: "https://example.com/hammer.jpg",
      orderIndex: 0,
    },
  ],
  specifications: {},
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "pickup_only" as const,
  deliveryFee: 0,
  deliveryRadius: 0,
  setupAvailable: false,
  setupFee: 0,
};

export const mockInvalidCreateListingFormData = {
  name: "", // Invalid: empty
  description: "", // Invalid: empty
  categoryId: "", // Invalid: empty
  condition: "good" as const,
  dailyRate: -10, // Invalid: negative
  securityDeposit: 0,
  images: [], // Invalid: empty
  specifications: {},
  minimumRentalPeriod: 1,
  maximumRentalPeriod: 30,
  deliveryMode: "pickup_only" as const,
  deliveryFee: 0,
  deliveryRadius: 0,
  setupAvailable: false,
  setupFee: 0,
};

// URL State Fixtures
export const mockURLSearchParams = {
  empty: new URLSearchParams(),
  withBasicFilters: new URLSearchParams(
    "q=drill&category=power-tools&minPrice=10&maxPrice=50",
  ),
  withCondition: new URLSearchParams("condition=good%2Cexcellent"),
  withBooleanFlags: new URLSearchParams("setup=true&availableNow=true"),
  withSort: new URLSearchParams("sortBy=price&sortOrder=asc&page=2"),
  withAllFilters: new URLSearchParams(
    "q=hammer&category=hand-tools&minPrice=5&maxPrice=25&condition=good&delivery=delivery_only&setup=true&availableNow=true&sortBy=price&sortOrder=asc&page=1",
  ),
};

// Error Fixtures
export const mockApiError = {
  message: "Failed to fetch listings",
  status: 500,
};

export const mockValidationError = {
  message: "Validation failed",
  errors: {
    name: ["Name is required"],
    dailyRate: ["Price must be positive"],
  },
};

// Image Fixtures
export const mockImageFile = new File(["test image content"], "test.jpg", {
  type: "image/jpeg",
  lastModified: Date.now(),
});

export const mockImageFiles = [
  new File(["image 1"], "image1.jpg", { type: "image/jpeg" }),
  new File(["image 2"], "image2.jpg", { type: "image/jpeg" }),
  new File(["image 3"], "image3.jpg", { type: "image/jpeg" }),
];

// Server Action Response Fixtures
export const mockServerActionSuccess = {
  success: true,
  data: { id: "listing-123" },
};

export const mockServerActionError = {
  success: false,
  error: "Failed to create listing",
};

export const mockServerActionValidationError = {
  success: false,
  error: "Validation failed",
  errors: {
    name: ["Name is required"],
    dailyRate: ["Price must be positive"],
  },
};

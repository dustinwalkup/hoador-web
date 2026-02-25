import type {
  OnboardingData,
  AddressData,
} from "@/features/onboarding/schemas/validation";
import type { UserProfile } from "@/dal/types";

// Valid complete onboarding data
export const mockOnboardingData: OnboardingData = {
  firstName: "John",
  lastName: "Doe",
  phone: "5551234567",
  address: {
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
  },
  bio: "I love sharing tools with my community!",
  profileImageUrl: "https://example.com/profile.jpg",
};

// Minimal valid data (required fields only)
export const mockOnboardingDataMinimal: OnboardingData = {
  firstName: "Jane",
  lastName: "Smith",
  phone: "5559876543",
  address: {
    street: "456 Oak Ave",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
  },
};

// Invalid data for error testing
export const mockOnboardingDataInvalid = {
  firstName: "", // Empty
  lastName: "", // Empty
  phone: "123", // Too short
  address: {
    street: "", // Empty
    city: "", // Empty
    state: "XX", // Invalid state
    zipCode: "123", // Invalid ZIP
  },
  bio: "A".repeat(201), // Too long
  profileImageUrl: "not-a-url", // Invalid URL
};

// Valid address data
export const mockAddressData: AddressData = {
  street: "789 Pine St",
  city: "Seattle",
  state: "WA",
  zipCode: "98101",
};

// Invalid address data
export const mockAddressDataInvalid = {
  street: "", // Empty
  city: "", // Empty
  state: "X", // Too short
  zipCode: "12", // Too short
};

// User object in onboarding state (before completing onboarding)
export const mockUserForOnboarding: UserProfile = {
  id: "user-onboarding-123",
  email: "onboarding@example.com",
  name: "User",
  firstName: "User", // Default from signup
  lastName: "",
  phone: null,
  profileImageUrl: null,
  emailVerified: true,
  image: null,
  status: "incomplete_profile",
  userType: "standard",
  bio: null,
  stripeCustomerId: null,
  stripeConnectedAccountId: null,
  connectOnboardingComplete: false,
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  idVerified: false,
  addressVerified: false,
  tosVersion: "1.0",
  tosAcceptedAt: new Date("2024-01-01"),
  privacyVersion: "1.0",
  privacyAcceptedAt: new Date("2024-01-01"),
  communityVersion: null,
  communityAcceptedAt: null,
  createdAt: new Date("2024-01-01"),
  preferences: null,
  primaryAddress: undefined,
  stats: {
    listingsBorrowed: 0,
    listingsShared: 0,
    averageRating: 0,
    totalReviews: 0,
  },
};

// User after completing onboarding
export const mockUserAfterOnboarding: UserProfile = {
  id: "user-onboarding-123",
  email: "onboarding@example.com",
  name: "John Doe",
  firstName: "John",
  lastName: "Doe",
  phone: "5551234567",
  profileImageUrl: "https://example.com/profile.jpg",
  emailVerified: true,
  image: null,
  status: "active",
  userType: "standard",
  bio: "I love sharing tools with my community!",
  stripeCustomerId: null,
  stripeConnectedAccountId: null,
  connectOnboardingComplete: false,
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  idVerified: false,
  addressVerified: false,
  tosVersion: "1.0",
  tosAcceptedAt: new Date("2024-01-01"),
  privacyVersion: "1.0",
  privacyAcceptedAt: new Date("2024-01-01"),
  communityVersion: null,
  communityAcceptedAt: null,
  createdAt: new Date("2024-01-01"),
  preferences: null,
  primaryAddress: {
    id: "address-123",
    userId: "user-onboarding-123",
    street: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    country: "US",
    latitude: null,
    longitude: null,
    isPrimary: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  stats: {
    listingsBorrowed: 0,
    listingsShared: 0,
    averageRating: 0,
    totalReviews: 0,
  },
};

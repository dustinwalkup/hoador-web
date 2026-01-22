import type { UserProfile } from "@/dal/types";

export const mockUser: UserProfile = {
  id: "user-123",
  email: "test@example.com",
  name: "John Doe",
  firstName: "John",
  lastName: "Doe",
  phone: "(555) 123-4567",
  profileImageUrl: "https://example.com/profile.jpg",
  emailVerified: true,
  image: null,
  status: "active",
  userType: "standard",
  bio: null,
  stripeCustomerId: null,
  stripeConnectedAccountId: null,
  connectOnboardingComplete: false,
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  idVerified: false,
  addressVerified: false,
  tosVersion: null,
  tosAcceptedAt: null,
  privacyVersion: null,
  privacyAcceptedAt: null,
  communityVersion: null,
  communityAcceptedAt: null,
  createdAt: new Date("2024-01-01"),
  preferences: {
    id: "pref-123",
    userId: "user-123",
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    marketingEmails: false,
    lendingRadius: 5,
    autoApproveRequests: false,
    weekendAvailability: true,
    defaultRentalPeriod: 3,
    publicProfile: true,
    showLocation: true,
    showActivityStatus: false,
    analyticsTracking: true,
    language: "en",
    timezone: "America/Chicago",
    currency: "USD",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  primaryAddress: undefined,
  stats: {
    listingsBorrowed: 5,
    listingsShared: 3,
    averageRating: 4.5,
    totalReviews: 8,
  },
};

export const mockUserMinimal = {
  id: "user-123",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "5551234567",
};

export const mockUserInvalid = {
  email: "invalid-email", // Invalid email format
  firstName: "", // Empty first name
  phone: "123", // Invalid phone (too short)
};

export const mockAddress = {
  id: "address-123",
  userId: "user-123",
  street: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
  unit: "Apt 4B",
  latitude: 37.7749,
  longitude: -122.4194,
  isDefault: true,
  createdAt: new Date("2024-01-01"),
};

export const mockAddressInvalid = {
  street: "", // Empty street
  city: "", // Empty city
  state: "XX", // Invalid state
  zipCode: "123", // Invalid ZIP (too short)
};

export const mockUserStats = {
  listingsBorrowed: 5,
  listingsShared: 3,
  averageRating: 4.5,
  totalReviews: 8,
};

export const mockAdminUser: UserProfile = {
  id: "admin-123",
  email: "admin@example.com",
  name: "Admin User",
  firstName: "Admin",
  lastName: "User",
  phone: "(555) 999-9999",
  profileImageUrl: null,
  emailVerified: true,
  image: null,
  status: "active",
  userType: "admin",
  bio: null,
  stripeCustomerId: null,
  stripeConnectedAccountId: null,
  connectOnboardingComplete: false,
  connectChargesEnabled: false,
  connectPayoutsEnabled: false,
  idVerified: true,
  addressVerified: true,
  tosVersion: "1.0",
  tosAcceptedAt: new Date("2024-01-01"),
  privacyVersion: "1.0",
  privacyAcceptedAt: new Date("2024-01-01"),
  communityVersion: "1.0",
  communityAcceptedAt: new Date("2024-01-01"),
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

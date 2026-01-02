export const mockSession = {
  user: {
    id: "user-123",
    email: "test@example.com",
    name: "John Doe",
    emailVerified: true,
  },
  session: {
    id: "session-123",
    userId: "user-123",
    expiresAt: new Date("2024-12-31"),
  },
};

export const mockAdminSession = {
  user: {
    id: "admin-123",
    email: "admin@example.com",
    name: "Admin User",
    emailVerified: true,
    role: "admin",
  },
  session: {
    id: "admin-session-123",
    userId: "admin-123",
    expiresAt: new Date("2024-12-31"),
  },
};

export const mockSignupData = {
  email: "newuser@example.com",
  password: "SecurePassword123!",
  firstName: "New",
  lastName: "User",
  phone: "5551234567",
  joinCode: "COMMUNITY123",
};

export const mockSignupDataInvalid = {
  email: "invalid-email",
  password: "weak", // Too weak
  firstName: "", // Empty
  lastName: "",
  phone: "123", // Invalid
};

export const mockLoginData = {
  email: "test@example.com",
  password: "SecurePassword123!",
};

export const mockForgotPasswordData = {
  email: "test@example.com",
};

export const mockResetPasswordData = {
  token: "reset-token-123",
  password: "NewSecurePassword123!",
  confirmPassword: "NewSecurePassword123!",
};

export const mockJoinCode = "COMMUNITY123";

export const mockJoinCodeInvalid = "INVALID123";

// User profile fixtures
import type { UserProfile } from "@/dal/types";

export const mockVerifiedUser: UserProfile = {
  id: "verified-user-123",
  email: "verified@example.com",
  name: "Verified User",
  firstName: "Verified",
  lastName: "User",
  phone: "(555) 111-2222",
  profileImageUrl: null,
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

export const mockUnverifiedUser: UserProfile = {
  id: "unverified-user-123",
  email: "unverified@example.com",
  name: "Unverified User",
  firstName: "Unverified",
  lastName: "User",
  phone: "(555) 333-4444",
  profileImageUrl: null,
  emailVerified: false,
  image: null,
  status: "pending_verification",
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
  preferences: null,
  primaryAddress: undefined,
  stats: {
    listingsBorrowed: 0,
    listingsShared: 0,
    averageRating: 0,
    totalReviews: 0,
  },
};

export const mockAdminUser: UserProfile = {
  id: "admin-user-123",
  email: "admin@example.com",
  name: "Admin User",
  firstName: "Admin",
  lastName: "User",
  phone: "(555) 555-5555",
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
  idVerified: false,
  addressVerified: false,
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

export const mockSuperAdminUser: UserProfile = {
  id: "superadmin-user-123",
  email: "superadmin@example.com",
  name: "Super Admin User",
  firstName: "Super",
  lastName: "Admin",
  phone: "(555) 666-7777",
  profileImageUrl: null,
  emailVerified: true,
  image: null,
  status: "active",
  userType: "superadmin",
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

// Token fixtures
export const mockEmailToken = "email-verification-token-12345";
export const mockResetToken = "password-reset-token-67890";
export const mockExpiredToken = "expired-token-11111";

// Legal documents fixtures
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import type { CurrentDocumentVersion } from "@/dal/legal-document.dal";

export const mockLegalDocuments: Record<string, CurrentDocumentVersion> = {
  [LEGAL_DOCUMENT_IDS.TOS]: {
    id: LEGAL_DOCUMENT_IDS.TOS,
    version: "1.0",
    url: "https://example.com/tos-1.0.pdf",
    publishedAt: new Date("2024-01-01"),
  },
  [LEGAL_DOCUMENT_IDS.PRIVACY]: {
    id: LEGAL_DOCUMENT_IDS.PRIVACY,
    version: "1.0",
    url: "https://example.com/privacy-1.0.pdf",
    publishedAt: new Date("2024-01-01"),
  },
  [LEGAL_DOCUMENT_IDS.COMMUNITY]: {
    id: LEGAL_DOCUMENT_IDS.COMMUNITY,
    version: "1.0",
    url: "https://example.com/community-1.0.pdf",
    publishedAt: new Date("2024-01-01"),
  },
};

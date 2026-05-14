import type {
  Community,
  CommunityMembership,
  CommunityNetwork,
  CommunityVisibility,
  CommunityWithStats,
  UserCommunityInfo,
} from "@/db/schemas/communities.schema";

export const mockCommunityNetwork: CommunityNetwork = {
  id: "network-123",
  name: "Test Network",
  slug: "test-network",
  description: "Test network for unit tests",
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockCommunity: Community = {
  id: "community-123",
  name: "Test Community",
  imageUrl: "https://example.com/community.jpg",
  joinCode: "COMMUNITY123",
  address: "123 Main St",
  city: "Test City",
  state: "CA",
  zip: "12345",
  networkId: mockCommunityNetwork.id,
  latitude: null,
  longitude: null,
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockInactiveCommunity: Community = {
  ...mockCommunity,
  id: "community-inactive-456",
  name: "Inactive Community",
  isActive: false,
};

export const mockCommunityWithStats: CommunityWithStats = {
  ...mockCommunity,
  memberCount: 10,
  listingCount: 25,
};

export const mockCommunityMembership: CommunityMembership = {
  id: "membership-123",
  userId: "user-123",
  communityId: "community-123",
  role: "member",
  isPrimary: true,
  verificationStatus: "verified",
  verifiedAt: new Date("2024-01-02"),
  verifiedBy: "admin-user-123",
  adminNotes: null,
  createdAt: new Date("2024-01-01"),
};

export const mockPendingMembership: CommunityMembership = {
  ...mockCommunityMembership,
  id: "membership-pending-789",
  userId: "user-pending-789",
  isPrimary: true,
  verificationStatus: "pending",
  verifiedAt: null,
  verifiedBy: null,
};

export const mockAdminMembership: CommunityMembership = {
  id: "membership-456",
  userId: "admin-user-123",
  communityId: "community-123",
  role: "admin",
  isPrimary: true,
  verificationStatus: "verified",
  verifiedAt: new Date("2024-01-02"),
  verifiedBy: "admin-user-123",
  adminNotes: null,
  createdAt: new Date("2024-01-01"),
};

export const mockCommunityVisibility: CommunityVisibility = {
  id: "visibility-123",
  userId: "user-123",
  communityId: "community-123",
  isVisible: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockUserCommunityInfo: UserCommunityInfo = {
  membership: mockCommunityMembership,
  community: mockCommunity,
};

export const mockJoinCode = "COMMUNITY123";
export const mockJoinCodeInvalid = "INVALID123";
export const mockJoinCodeEmpty = "";

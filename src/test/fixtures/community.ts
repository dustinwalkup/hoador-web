import type {
  Community,
  CommunityMembership,
  CommunityWithStats,
  UserCommunityInfo,
} from "@/db/schemas/communities.schema";

export const mockCommunity: Community = {
  id: "community-123",
  name: "Test Community",
  imageUrl: "https://example.com/community.jpg",
  joinCode: "COMMUNITY123",
  address: "123 Main St",
  city: "Test City",
  state: "CA",
  zip: "12345",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
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
  createdAt: new Date("2024-01-01"),
};

export const mockAdminMembership: CommunityMembership = {
  id: "membership-456",
  userId: "admin-user-123",
  communityId: "community-123",
  role: "admin",
  createdAt: new Date("2024-01-01"),
};

export const mockUserCommunityInfo: UserCommunityInfo = {
  membership: mockCommunityMembership,
  community: mockCommunity,
};

export const mockJoinCode = "COMMUNITY123";
export const mockJoinCodeInvalid = "INVALID123";
export const mockJoinCodeEmpty = "";

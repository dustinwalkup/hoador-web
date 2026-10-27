import { describe, it, expect, vi, beforeEach } from "vitest";
import { canViewOwnerItem } from "../item-visibility";

vi.mock("@/dal", () => ({
  communityDAL: {
    isVisibleInCommunity: vi.fn(),
    areMutuallyVisible: vi.fn(),
  },
}));

import { communityDAL } from "@/dal";

describe("canViewOwnerItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(communityDAL.isVisibleInCommunity).mockResolvedValue(true);
    vi.mocked(communityDAL.areMutuallyVisible).mockResolvedValue(true);
  });

  it("is true when both are visible in the item's community and neither hid the other", async () => {
    await expect(
      canViewOwnerItem("viewer-b", "owner-a", "comm-g"),
    ).resolves.toBe(true);

    expect(communityDAL.isVisibleInCommunity).toHaveBeenCalledWith(
      "viewer-b",
      "comm-g",
    );
    expect(communityDAL.isVisibleInCommunity).toHaveBeenCalledWith(
      "owner-a",
      "comm-g",
    );
    expect(communityDAL.areMutuallyVisible).toHaveBeenCalledWith(
      "viewer-b",
      "owner-a",
    );
  });

  // SETTINGS-004: the item lives in the owner's unhideable home, so only the
  // member-based check can catch an owner who hid the viewer's community.
  it("is false when the owner hid the viewer's home community", async () => {
    vi.mocked(communityDAL.areMutuallyVisible).mockResolvedValue(false);
    await expect(
      canViewOwnerItem("viewer-b", "owner-a", "comm-g"),
    ).resolves.toBe(false);
  });

  it("is false when the viewer is not visible in the item's community", async () => {
    vi.mocked(communityDAL.isVisibleInCommunity).mockImplementation(
      async (userId) => userId !== "viewer-b",
    );
    await expect(
      canViewOwnerItem("viewer-b", "owner-a", "comm-g"),
    ).resolves.toBe(false);
  });

  it("is false when the owner is not visible in the item's community", async () => {
    vi.mocked(communityDAL.isVisibleInCommunity).mockImplementation(
      async (userId) => userId !== "owner-a",
    );
    await expect(
      canViewOwnerItem("viewer-b", "owner-a", "comm-g"),
    ).resolves.toBe(false);
  });
});

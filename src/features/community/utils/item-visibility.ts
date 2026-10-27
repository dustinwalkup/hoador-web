import { communityDAL } from "@/dal";

/**
 * Whether `viewerId` may see (open, request, book or quote) an item owned by
 * `ownerId` that lives in `communityId`. The single gate every item detail,
 * request and booking check uses, so they all apply the same rule as the
 * feeds:
 *
 * - both the viewer and the owner are visible in the item's community (R5),
 *   AND
 * - neither has hidden the other's home community (member-based rule,
 *   SETTINGS-004, approved 2026-10-26). An item lives in its owner's primary
 *   community, which can't be hidden, so without this an owner who hid the
 *   viewer's community stayed reachable by every member of it.
 *
 * Callers handle the owner and admins before calling this. Not for existing
 * rentals, bookings or conversations between the two: those stay reachable
 * from their own records.
 */
export async function canViewOwnerItem(
  viewerId: string,
  ownerId: string,
  communityId: string,
): Promise<boolean> {
  const [viewerVisible, ownerVisible, mutuallyVisible] = await Promise.all([
    communityDAL.isVisibleInCommunity(viewerId, communityId),
    communityDAL.isVisibleInCommunity(ownerId, communityId),
    communityDAL.areMutuallyVisible(viewerId, ownerId),
  ]);
  return viewerVisible && ownerVisible && mutuallyVisible;
}

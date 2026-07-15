import { after } from "next/server";
import {
  communityDAL,
  listingDAL,
  neighborhoodNeedsDAL,
  serviceListingDAL,
} from "@/dal";
import { ConflictError, ForbiddenError, ValidationError } from "@/dal/errors";
import type { NeedCloseReason, NeedType } from "@/dal/neighborhood-needs.dal";
import type {
  NewNeighborhoodNeed,
  NeighborhoodNeed,
} from "@/db/schemas/neighborhood-needs.schema";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { sendNotification } from "@/features/notifications/utils/send-notification";

export interface CreateNeedInput {
  type: NeedType;
  categoryId: string;
  title: string;
  description: string;
  neededStartDate?: string | null;
  neededEndDate?: string | null;
}

export interface UpdateNeedInput {
  title?: string;
  description?: string;
  categoryId?: string;
  neededStartDate?: string | null;
  neededEndDate?: string | null;
}

// ============================
// 6.1 createNeed
// ============================

export async function createNeed(
  userId: string,
  input: CreateNeedInput,
): Promise<NeighborhoodNeed> {
  const primary = await communityDAL.getPrimaryMembershipForUser(userId);
  if (!primary) {
    throw new ValidationError(
      "You must belong to a community to post a Neighborhood Need.",
    );
  }

  await validateCategoryForType(input.type, input.categoryId);
  validateDateOrder(input.neededStartDate, input.neededEndDate);

  const data: NewNeighborhoodNeed = {
    createdByUserId: userId,
    communityId: primary.community.id,
    type: input.type,
    categoryId: input.categoryId,
    title: input.title,
    description: input.description,
    neededStartDate: input.neededStartDate ?? null,
    neededEndDate: input.neededEndDate ?? null,
  };

  const need = await neighborhoodNeedsDAL.createNeed(data);

  after(async () => {
    await fanOutNewNeed(need, userId).catch((err) =>
      captureNonCriticalError(err, {
        route: "/api/needs",
        action: "fanOutNewNeed",
      }),
    );
  });

  return need;
}

// ============================
// 6.2 updateNeed / closeNeed / deleteNeed
// ============================

export async function updateNeed(
  id: string,
  input: UpdateNeedInput,
  actor: { userId: string; isAdmin: boolean },
): Promise<NeighborhoodNeed> {
  const need = await neighborhoodNeedsDAL.getNeedById(id);
  if (!need) throw new ValidationError("Neighborhood Need not found.");

  if (need.status === "closed" || need.deletedAt) {
    throw new ValidationError("Cannot edit a closed or deleted Need.");
  }

  if (!actor.isAdmin && need.createdByUserId !== actor.userId) {
    throw new ForbiddenError("Only the owner or an admin may edit this Need.");
  }

  if (input.categoryId && input.categoryId !== need.categoryId) {
    await validateCategoryForType(need.type, input.categoryId);
  }

  validateDateOrder(
    input.neededStartDate !== undefined
      ? input.neededStartDate
      : need.neededStartDate,
    input.neededEndDate !== undefined
      ? input.neededEndDate
      : need.neededEndDate,
  );

  return neighborhoodNeedsDAL.updateNeed(id, input);
}

export async function closeNeed(
  id: string,
  actor: { userId: string; isAdmin: boolean },
): Promise<NeighborhoodNeed> {
  const need = await neighborhoodNeedsDAL.getNeedById(id);
  if (!need) throw new ValidationError("Neighborhood Need not found.");

  if (!actor.isAdmin && need.createdByUserId !== actor.userId) {
    throw new ForbiddenError("Only the owner or an admin may close this Need.");
  }

  // Idempotent: already closed is a no-op success
  if (need.status === "closed") return need;

  const reason: NeedCloseReason = actor.isAdmin ? "admin" : "manual";
  return neighborhoodNeedsDAL.closeNeed(id, reason);
}

export async function deleteNeed(
  id: string,
  actor: { isAdmin: boolean },
): Promise<void> {
  if (!actor.isAdmin) {
    throw new ForbiddenError("Only admins may delete a Neighborhood Need.");
  }

  const need = await neighborhoodNeedsDAL.getNeedByIdIncludingDeleted(id);
  if (!need) throw new ValidationError("Neighborhood Need not found.");

  if (need.deletedAt) return; // already soft-deleted, no-op

  await neighborhoodNeedsDAL.softDeleteNeed(id);
}

// ============================
// 6.3 linkListingToNeed
// ============================

export async function linkListingToNeed(args: {
  neighborhoodNeedId: string;
  listingType: NeedType;
  listingId: string;
  creatorUserId: string;
}): Promise<void> {
  const { neighborhoodNeedId, listingType, listingId, creatorUserId } = args;

  const need = await neighborhoodNeedsDAL.getNeedById(neighborhoodNeedId);

  // No-op: need missing, deleted (getNeedById excludes deleted), or closed
  if (!need || need.status !== "open") return;

  // No-op: listing type does not match need type
  if (need.type !== listingType) return;

  // No-op: listing creator cannot see the need (creator's side of symmetric visibility)
  const visibleIds = await communityDAL.getVisibleCommunityIds(creatorUserId);
  if (!visibleIds.includes(need.communityId)) return;

  try {
    await neighborhoodNeedsDAL.linkListing({
      neighborhoodNeedId,
      listingType,
      listingId,
    });
  } catch (err) {
    // Swallow UNIQUE violation — listing already linked to another need
    if (err instanceof ConflictError) return;
    throw err;
  }
}

// ============================
// 6.4 notifyRequesterListingLive
// ============================

export async function notifyRequesterListingLive(
  listingType: NeedType,
  listingId: string,
): Promise<void> {
  const link = await neighborhoodNeedsDAL.getLinkByListing(
    listingType,
    listingId,
  );
  if (!link) return;

  const need = await neighborhoodNeedsDAL.getNeedById(link.neighborhoodNeedId);
  if (!need) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hoador.com";
  const href =
    listingType === "rental"
      ? `${baseUrl}/dashboard/listings/${listingId}`
      : `${baseUrl}/dashboard/services/listings/${listingId}`;

  await sendNotification({
    userId: need.createdByUserId,
    type: "neighborhood_need_listing_created",
    title: "A listing was created for your request",
    message: "A new listing has been created for your Neighborhood Need.",
    linkUrl: href,
    data: { listingId, listingType, needId: need.id },
  });
}

// ============================
// 6.5 closeNeedsFulfilledByBooking
// ============================

export async function closeNeedsFulfilledByBooking(args: {
  listingType: NeedType;
  listingId: string;
  bookerUserId: string;
}): Promise<void> {
  const { listingType, listingId, bookerUserId } = args;

  const openNeeds = await neighborhoodNeedsDAL.findOpenNeedsLinkedToListing(
    listingType,
    listingId,
  );

  // Close only needs where the booker IS the need's creator (R10.1–10.2)
  const toClose = openNeeds.filter((n) => n.createdByUserId === bookerUserId);

  await Promise.all(
    toClose.map((n) => neighborhoodNeedsDAL.closeNeed(n.id, "booking")),
  );
}

// ============================
// Private helpers
// ============================

async function validateCategoryForType(
  type: NeedType,
  categoryId: string,
): Promise<void> {
  if (type === "rental") {
    const categories = await listingDAL.getListingCategories();
    const valid = categories.some((c) => c.id === categoryId);
    if (!valid) {
      throw new ValidationError(
        "Invalid category for a rental need.",
        "categoryId",
      );
    }
  } else {
    const categories = await serviceListingDAL.listCategories();
    const valid = categories.some((c) => c.id === categoryId);
    if (!valid) {
      throw new ValidationError(
        "Invalid category for a service need.",
        "categoryId",
      );
    }
  }
}

function validateDateOrder(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): void {
  if (!start || !end) return;
  if (new Date(end) < new Date(start)) {
    throw new ValidationError(
      "Needed end date must not be before the start date.",
      "neededEndDate",
    );
  }
}

async function fanOutNewNeed(
  need: NeighborhoodNeed,
  creatorUserId: string,
): Promise<void> {
  const recipientIds = await communityDAL.getUserIdsVisibleInCommunity(
    need.communityId,
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hoador.com";
  const linkUrl = `${baseUrl}/dashboard/needs/${need.id}`;

  await Promise.all(
    recipientIds
      .filter((uid) => uid !== creatorUserId)
      .map((uid) =>
        sendNotification({
          userId: uid,
          type: "neighborhood_need_created",
          title: "New Neighborhood Need",
          message: `A neighbor posted a new ${need.type} request: "${need.title}"`,
          linkUrl,
          data: { needId: need.id, needType: need.type },
          // In-app always; email hard-off (no fan-out spam). Push is left to
          // shouldSendPush(), which honors the user's opt-in for the
          // neighborhood_needs category (default off) — see R12.4 / task 7.2.
          sendEmail: false,
        }).catch((err) =>
          captureNonCriticalError(err, {
            route: "/api/needs",
            action: "fanOutNewNeed.sendNotification",
          }),
        ),
      ),
  );
}

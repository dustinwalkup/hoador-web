import { after } from "next/server";
import {
  communityDAL,
  listingDAL,
  neighborhoodNeedsDAL,
  notificationsDAL,
  pushSubscriptionDAL,
  serviceListingDAL,
} from "@/dal";
import {
  ConflictError,
  ForbiddenError,
  NeedLimitReachedError,
  ValidationError,
} from "@/dal/errors";
import type { NeedCloseReason, NeedType } from "@/dal/neighborhood-needs.dal";
import type {
  NewNeighborhoodNeed,
  NeighborhoodNeed,
} from "@/db/schemas/neighborhood-needs.schema";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { buildPushPayload } from "@/features/notifications/lib/push-payload";
import { broadcastPush } from "@/features/notifications/lib/push-service";
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

/**
 * Posting limits (SEC-15). Each post notifies the poster's whole network, so
 * these cap how much a single member can push into everyone's inbox. They are
 * a starting point, not a product decision; adjust freely.
 */
export const MAX_OPEN_NEEDS_PER_USER = 5;
export const MAX_NEEDS_PER_USER_PER_DAY = 10;

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
  await assertUnderPostingLimits(userId);

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

/**
 * Soft-delete a Need. **Creator or admin** (P-E13-4).
 *
 * This was admin-only — it threw `ForbiddenError("Only admins may delete a
 * Neighborhood Need.")` before it even looked at ownership, and the route
 * gated on `requireAdminResponse()` on top of that. Requirement 20.1.3 says
 * *"The creator shall be able to edit, manually close, **and delete** their
 * need"*, so a creator had two of the three.
 *
 * Deletion is a soft delete (`deleted_at`), and `getNeedById` already excludes
 * deleted rows, so a deleted need leaves the feed, the detail view and every
 * link fan-out without touching the listings that were created from it.
 *
 * Idempotent: deleting an already-deleted need is a no-op success, matching
 * `closeNeed`.
 */
export async function deleteNeed(
  id: string,
  actor: { userId?: string; isAdmin: boolean },
): Promise<void> {
  const need = await neighborhoodNeedsDAL.getNeedByIdIncludingDeleted(id);
  if (!need) throw new ValidationError("Neighborhood Need not found.");

  if (!actor.isAdmin && need.createdByUserId !== actor.userId) {
    throw new ForbiddenError(
      "Only the owner or an admin may delete this Need.",
    );
  }

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
  // Symmetric visibility: a need is only visible when its creator is visible in
  // its community. If the creator isn't visible, the need is invisible to
  // everyone — skip the fan-out entirely (fail-closed; prevents notifying users
  // who retain stale visibility into the creator's community).
  const creatorVisible = await communityDAL.isVisibleInCommunity(
    creatorUserId,
    need.communityId,
  );
  if (!creatorVisible) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hoador.com";
  const linkUrl = `${baseUrl}/dashboard/needs/${need.id}`;
  const title = "New Neighborhood Need";
  const message = `A neighbor posted a new ${need.type} request: "${need.title}"`;
  const data = { needId: need.id, needType: need.type };

  // Set-based, not one `sendNotification` per member (PERF-02). That cost ~4
  // queries per recipient, all released into the 10-connection pool at once;
  // a 3,000-member network saturated it for seconds, stalling every request
  // on the instance. Now: one INSERT … SELECT for the in-app rows, one join
  // for push targets, one batched Expo send with bulk-written audit rows.
  // What recipients get is unchanged: an in-app row for every visible member
  // (with `linkUrl` in `data`, as `sendNotification` wrote it), no email, and
  // push only for members who opted in to the neighborhood_needs category
  // (default off, R12.4 / task 7.2).
  await notificationsDAL.bulkCreateForVisibleCommunity({
    communityId: need.communityId,
    excludeUserId: creatorUserId,
    type: "neighborhood_need_created",
    title,
    message,
    data: { ...data, linkUrl },
  });

  // Push failures never fail the fan-out, and never block the in-app rows
  // above, which are already written.
  await pushSubscriptionDAL
    .getOptInPushTargetsInCommunity({
      communityId: need.communityId,
      excludeUserId: creatorUserId,
      category: "neighborhood_needs",
    })
    .then((targets) =>
      broadcastPush(
        targets,
        buildPushPayload(
          title,
          message,
          linkUrl,
          "neighborhood_need_created",
          data,
        ),
      ),
    )
    .catch((err) =>
      captureNonCriticalError(err, {
        route: "/api/needs",
        action: "fanOutNewNeed.push",
      }),
    );
}

/**
 * Throw `NeedLimitReachedError` when a user already has too many open needs,
 * or has posted too many in the last 24 hours (SEC-15). A plain count query:
 * there is no durable rate-limit store in this repo. Two posts racing past the
 * check can each land, which is acceptable for a spam throttle.
 */
async function assertUnderPostingLimits(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { open, recent } = await neighborhoodNeedsDAL.getPostingCounts(
    userId,
    since,
  );
  if (open >= MAX_OPEN_NEEDS_PER_USER) {
    throw new NeedLimitReachedError(
      `You can have up to ${MAX_OPEN_NEEDS_PER_USER} open Neighborhood Needs at a time. Close one to post another.`,
    );
  }
  if (recent >= MAX_NEEDS_PER_USER_PER_DAY) {
    throw new NeedLimitReachedError(
      `You can post up to ${MAX_NEEDS_PER_USER_PER_DAY} Neighborhood Needs a day. Try again tomorrow.`,
    );
  }
}

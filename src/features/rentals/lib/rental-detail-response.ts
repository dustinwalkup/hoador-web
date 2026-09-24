import type { RentalDetails } from "@/dal/rentals.dal";

/**
 * Statuses at which the owner has accepted the renter, so each side has a
 * reason to know where the item changes hands. `overdue` is a post-`active`
 * state in which the item still has to go back, so it counts too.
 */
const ADDRESS_VISIBLE_STATUSES = new Set([
  "approved",
  "active",
  "overdue",
  "completed",
]);

export type RentalViewerRole = "renter" | "owner" | "admin";

type ContactField = "renterEmail" | "renterPhone" | "ownerEmail" | "ownerPhone";

/** The rental detail as a client may see it: never the counterparty's contact info. */
export type RentalDetailResponse = Omit<RentalDetails, ContactField>;

/**
 * Projects the full DAL row down to what one viewer may see (PRIV-01). Every
 * consumer that serializes a rental detail to a client (the API route and the
 * web detail page's RSC props) must go through this, never spread the row.
 *
 * - Admins keep the full row.
 * - Everyone else loses `*Email`/`*Phone` at every status.
 * - Each street address is visible to the party it belongs to (`pickupAddress`
 *   is the owner's, `deliveryAddress` the renter's), and to the counterparty
 *   only once the request is approved. A pending, denied or cancelled request
 *   reveals nothing, so request→read→cancel cannot harvest addresses.
 */
export function toRentalDetailResponse(
  data: RentalDetails,
  viewerRole: RentalViewerRole,
): RentalDetailResponse {
  if (viewerRole === "admin") return data;
  const unlocked = ADDRESS_VISIBLE_STATUSES.has(data.status);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { renterEmail, renterPhone, ownerEmail, ownerPhone, ...rest } = data;
  return {
    ...rest,
    pickupAddress:
      viewerRole === "owner" || unlocked ? data.pickupAddress : undefined,
    deliveryAddress:
      viewerRole === "renter" || unlocked ? data.deliveryAddress : undefined,
  };
}

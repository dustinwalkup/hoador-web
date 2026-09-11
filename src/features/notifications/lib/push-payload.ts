import type { NotificationType } from "./notification-type-map";

/**
 * The two marketplaces a single notification type can point at.
 *
 * Mirrors the `need_type` pg enum and the `bookingType` union that
 * `sendReviewReleasedNotification` already takes. Pinned to those in
 * `__tests__/push-payload.test.ts` so a third marketplace cannot be added to
 * the database without this file noticing.
 */
export type MarketplaceKind = "rental" | "service";

const MARKETPLACE_KINDS: readonly string[] = ["rental", "service"];

/**
 * Push payload shape: reference IDs only, no PII or financial data.
 * Requirements: 7.1, 7.2, 7.3
 */
export interface PushPayload {
  title: string;
  body: string;
  linkUrl: string;
  data: {
    type: NotificationType;
    rentalId?: string;
    /**
     * The rental REQUEST id. `expire-pending-bookings.ts` is the one sender
     * that names a cancelled rental this way and passes no `rentalId` at all,
     * so without this key its push has no rental reference to resolve from.
     * `/api/rentals/[id]` accepts either form.
     */
    rentalRequestId?: string;
    conversationId?: string;
    disputeId?: string;
    /** Service bookings. Senders pass `bookingId`, never `serviceBookingId`. */
    bookingId?: string;
    /** Item AND service listings alike — service listings have no separate key. */
    listingId?: string;
    needId?: string;
    /** Disambiguates `review_received`, which spans both marketplaces. */
    bookingType?: MarketplaceKind;
    /** Disambiguates `neighborhood_need_listing_created`, likewise. */
    listingType?: MarketplaceKind;
  };
}

/**
 * Builds a push payload with only reference IDs in data.
 * Strips any PII or financial fields from the optional data object.
 *
 * ## ⚠️ This is an ALLOWLIST. Never turn it into a passthrough.
 *
 * Copying `data` wholesale looks like a simplification and is not one.
 * Notification data bags carry money at **11 call sites across 7 files** —
 * `totalAmount` on the four rental payment senders and both service booking
 * senders, `refundAmount` on the cancellation and service-refund paths — as
 * well as `renterName`, `ownerName`, `listingName` and `failureReason`. This
 * function is the only thing standing between those and a lock screen, which is
 * what the mobile app's Req 2.2.3 / 18.2.4 forbid. One line per key, so the
 * allowlist stays greppable and its intent stays legible.
 *
 * Deliberately excluded even though they sit beside the keys below:
 * `reviewerName`, `renterName`, `ownerName`, `listingName`, `title`, `name`
 * (PII and free text), `rating`, `totalAmount`, `refundAmount` (values), and
 * `providerId` / `ownerId` / `renterId` (user ids are identifying, and are
 * never a navigation subject).
 *
 * ## Why the two non-id keys are here
 *
 * `bookingType` and `listingType` are not ids and are still required. Every
 * other notification type names its marketplace itself — `listing_approved` and
 * `service_listing_approved` are separate enum values — but `review_received`
 * and `neighborhood_need_listing_created` are single types spanning both, so
 * their id alone cannot choose a destination screen. Without the discriminator
 * a push lands in the wrong marketplace, which is worse than falling back to
 * the notification feed. They are validated against the two known values rather
 * than accepted as any string: an unrecognized value drops the key, and the
 * client then resolves by `linkUrl` instead of guessing a marketplace.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param linkUrl - URL to open on click (e.g. /dashboard/rentals/abc123)
 * @param type - Notification type for analytics and routing
 * @param data - Optional object; only the reference ids and the two marketplace
 *   discriminators listed on `PushPayload["data"]` are included
 * @returns PushPayload safe to send via Web Push
 */
export function buildPushPayload(
  title: string,
  body: string,
  linkUrl: string,
  type: NotificationType,
  data?: Record<string, string | number | boolean | string[] | null>,
): PushPayload {
  const safeData: PushPayload["data"] = { type };

  if (data && typeof data === "object") {
    if (typeof data.rentalId === "string") safeData.rentalId = data.rentalId;
    if (typeof data.rentalRequestId === "string")
      safeData.rentalRequestId = data.rentalRequestId;
    if (typeof data.conversationId === "string")
      safeData.conversationId = data.conversationId;
    if (typeof data.disputeId === "string") safeData.disputeId = data.disputeId;
    if (typeof data.bookingId === "string") safeData.bookingId = data.bookingId;
    if (typeof data.listingId === "string") safeData.listingId = data.listingId;
    if (typeof data.needId === "string") safeData.needId = data.needId;
    if (isMarketplaceKind(data.bookingType))
      safeData.bookingType = data.bookingType;
    if (isMarketplaceKind(data.listingType))
      safeData.listingType = data.listingType;
  }

  return {
    title,
    body,
    linkUrl,
    data: safeData,
  };
}

function isMarketplaceKind(value: unknown): value is MarketplaceKind {
  return typeof value === "string" && MARKETPLACE_KINDS.includes(value);
}

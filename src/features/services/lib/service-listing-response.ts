import type { ServiceListingWithCategoryAndProvider } from "@/dal/service-listing.dal";

type ModerationField = "adminNote" | "rejectionReason";

/** The listing detail as a viewer other than its provider may see it. */
export type PublicServiceListingDetail = Omit<
  ServiceListingWithCategoryAndProvider,
  ModerationField
>;

/**
 * Projects a listing detail for the wire (PRIV-03). Every viewer gets the
 * provider rebuilt from an explicit allowlist, so a contact field added to the
 * DAL join (as `email` once was) cannot reach the client by default. Anyone
 * who isn't the listing's own provider also loses the moderation-internal
 * fields; the provider keeps them, since the mobile edit screen renders
 * `rejectionReason` for a denied listing (services.contract.ts).
 */
export function toServiceListingDetailResponse(
  listing: ServiceListingWithCategoryAndProvider,
  isProvider: boolean,
): ServiceListingWithCategoryAndProvider | PublicServiceListingDetail {
  const { id, firstName, lastName, profileImageUrl } = listing.provider;
  const provider = { id, firstName, lastName, profileImageUrl };
  if (isProvider) return { ...listing, provider };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminNote, rejectionReason, ...rest } = listing;
  return { ...rest, provider };
}

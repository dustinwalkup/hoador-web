import { describe, it, expect } from "vitest";

import type { ServiceListingWithCategoryAndProvider } from "@/dal/service-listing.dal";
import { toServiceListingDetailResponse } from "../service-listing-response";

/**
 * PRIV-03: moderation-internal fields are for the listing's own provider only,
 * and nobody gets provider contact info off the listing detail.
 */

const listing = {
  id: "list-1",
  providerId: "provider-1",
  communityId: "comm-1",
  title: "Lawn mowing",
  status: "denied",
  adminNote: "Flagged: provider asked for off-platform payment",
  rejectionReason: "Photos did not match the service",
  category: { id: "cat-1", name: "Lawn care", description: null },
  provider: {
    id: "provider-1",
    firstName: "Pat",
    lastName: "Provider",
    profileImageUrl: null,
    // Not on the type any more; stands in for any contact field a future
    // change adds to the DAL join.
    email: "pat@example.com",
  },
} as unknown as ServiceListingWithCategoryAndProvider;

const SAFE_PROVIDER = {
  id: "provider-1",
  firstName: "Pat",
  lastName: "Provider",
  profileImageUrl: null,
};

describe("toServiceListingDetailResponse", () => {
  it("keeps the moderation notes for the provider", () => {
    const out = toServiceListingDetailResponse(listing, true);

    expect(out).toMatchObject({
      adminNote: "Flagged: provider asked for off-platform payment",
      rejectionReason: "Photos did not match the service",
    });
  });

  it("drops the moderation notes for anyone else and keeps everything else", () => {
    const out = toServiceListingDetailResponse(listing, false);

    expect(out).not.toHaveProperty("adminNote");
    expect(out).not.toHaveProperty("rejectionReason");
    expect(out).toMatchObject({
      id: "list-1",
      title: "Lawn mowing",
      status: "denied",
      category: listing.category,
    });
  });

  it.each([true, false])(
    "rebuilds the provider from an allowlist (isProvider: %s)",
    (isProvider) => {
      const out = toServiceListingDetailResponse(listing, isProvider);

      expect(out.provider).toEqual(SAFE_PROVIDER);
    },
  );
});

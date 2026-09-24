import { describe, it, expect } from "vitest";

import { mockRentalDetails } from "@/test/fixtures/rentals";
import type { RentalDetails } from "@/dal/rentals.dal";
import {
  toRentalDetailResponse,
  type RentalViewerRole,
} from "../rental-detail-response";

/**
 * PRIV-01: the rental detail must never hand a party the counterparty's email
 * or phone, and must not reveal either street address to the counterparty
 * until the owner has accepted the request.
 */

const STATUSES = [
  "pending",
  "approved",
  "active",
  "completed",
  "cancelled",
  "overdue",
  "denied",
] as const;
const UNLOCKED = new Set(["approved", "active", "overdue", "completed"]);
const PARTY_ROLES = ["renter", "owner"] as const;

const row = (status: string): RentalDetails => ({
  ...mockRentalDetails,
  status,
  renterEmail: "jane@example.com",
  renterPhone: "555-0100",
  ownerEmail: "john@example.com",
  ownerPhone: "555-0199",
  pickupAddress: "12 Owner Lane, Springfield",
  deliveryAddress: "34 Renter Road, Springfield",
});

const CONTACT_FIELDS = [
  "renterEmail",
  "renterPhone",
  "ownerEmail",
  "ownerPhone",
] as const;

describe("toRentalDetailResponse", () => {
  describe.each(STATUSES)("status %s", (status) => {
    it.each(PARTY_ROLES)("strips every contact field for the %s", (role) => {
      const out = toRentalDetailResponse(row(status), role);

      for (const field of CONTACT_FIELDS) {
        expect(out).not.toHaveProperty(field);
      }
      // Nothing else in the payload can smuggle an email back out.
      expect(JSON.stringify(out)).not.toContain("@");
    });

    it("shows the owner's pickup address to the renter only once approved", () => {
      const out = toRentalDetailResponse(row(status), "renter");

      expect(out.pickupAddress).toBe(
        UNLOCKED.has(status) ? "12 Owner Lane, Springfield" : undefined,
      );
    });

    it("shows the renter's delivery address to the owner only once approved", () => {
      const out = toRentalDetailResponse(row(status), "owner");

      expect(out.deliveryAddress).toBe(
        UNLOCKED.has(status) ? "34 Renter Road, Springfield" : undefined,
      );
    });

    // A party's own address is not a leak; hiding it would blank the renter's
    // "Delivery to …" line on their own pending request.
    it("always shows each party their own address", () => {
      expect(toRentalDetailResponse(row(status), "owner").pickupAddress).toBe(
        "12 Owner Lane, Springfield",
      );
      expect(
        toRentalDetailResponse(row(status), "renter").deliveryAddress,
      ).toBe("34 Renter Road, Springfield");
    });

    it("returns the row unchanged for an admin", () => {
      const input = row(status);
      const role: RentalViewerRole = "admin";

      expect(toRentalDetailResponse(input, role)).toBe(input);
    });
  });

  it("passes every non-sensitive field through untouched", () => {
    const input = row("approved");
    const out = toRentalDetailResponse(input, "renter");

    expect(out).toMatchObject({
      id: input.id,
      renterName: input.renterName,
      ownerName: input.ownerName,
      totalAmount: input.totalAmount,
      startDate: input.startDate,
      conversationId: input.conversationId,
    });
  });
});

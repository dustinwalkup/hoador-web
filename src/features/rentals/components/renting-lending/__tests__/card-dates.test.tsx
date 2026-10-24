import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { BorrowedListing, LendingRequestItem } from "@/dal/rentals.dal";

vi.mock("next/image", () => ({
  default: () => null,
}));
vi.mock("@/features/messages/components/message-user-modal", () => ({
  MessageUserModal: () => null,
}));
vi.mock("../cancel-request-dialog", () => ({
  CancelRequestDialog: () => null,
}));
vi.mock("@/features/rentals/components/renting-lending", () => ({
  ApproveRequestDialog: () => null,
  DeclineRequestDialog: () => null,
}));
vi.mock("@/features/payments/components/payout-setup-required-dialog", () => ({
  PayoutSetupRequiredDialog: () => null,
}));

import { RentalCard } from "../rental-card";
import { LendingCard } from "../lending-card";

/**
 * HOA-124: the renting and lending cards print the booked days. A
 * mobile-stored Oct 27 arrives as `2026-10-27T00:00Z`, which a Central browser
 * formatted as Oct 26. Both cards render a mobile and a desktop layout, so the
 * range appears twice.
 */
const range = `${new Date(2026, 9, 27).toLocaleDateString()} to ${new Date(2026, 9, 29).toLocaleDateString()}`;
const stored = {
  startDate: new Date("2026-10-27T00:00:00.000Z"),
  endDate: new Date("2026-10-29T00:00:00.000Z"),
};

describe("renting and lending cards — booked days", () => {
  it("RentalCard shows the booked range", () => {
    render(
      <RentalCard
        variant="active"
        rental={
          {
            id: "req-1",
            listingId: "l-1",
            listingName: "Cordless drill",
            listingImageUrl: null,
            ownerId: "owner-1",
            ownerName: "Mike Ross",
            deliveryRequested: false,
            totalAmount: "80.00",
            status: "approved",
            dailyRate: "25.00",
            ...stored,
          } as unknown as BorrowedListing
        }
      />,
    );

    expect(screen.getAllByText(new RegExp(range))).not.toHaveLength(0);
  });

  it("LendingCard shows the booked range", () => {
    render(
      <LendingCard
        request={
          {
            id: "req-1",
            listingId: "l-1",
            listingName: "Cordless drill",
            listingImageUrl: null,
            renterId: "renter-1",
            renterName: "Sarah Chen",
            totalDays: 3,
            dailyRate: "25.00",
            totalAmount: "80.00",
            securityDeposit: "0.00",
            status: "pending",
            createdAt: new Date("2026-10-20T15:00:00.000Z"),
            deliveryRequested: false,
            deliveryAddress: null,
            deliveryFee: "0.00",
            message: null,
            ...stored,
          } as LendingRequestItem
        }
      />,
    );

    expect(screen.getAllByText(new RegExp(range))).not.toHaveLength(0);
  });
});

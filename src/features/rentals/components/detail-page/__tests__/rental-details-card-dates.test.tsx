import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { RentalDetailsInfo } from "@/dal/rentals.dal";

vi.mock("@/components/payments/how-payments-work-modal", () => ({
  HowPaymentsWorkModal: () => null,
}));

import { RentalDetailsCard } from "../rental-details-card";

/**
 * HOA-124: Start Date / End Date are booked days. A mobile-stored Oct 27 is
 * `2026-10-27T00:00Z`, which a Central zone formatted as Oct 26.
 */
describe("RentalDetailsCard — booked days", () => {
  it("shows the booked start and end days", () => {
    render(
      <RentalDetailsCard
        rentalDetails={
          {
            startDate: new Date("2026-10-27T00:00:00.000Z"),
            endDate: new Date("2026-10-29T00:00:00.000Z"),
            totalDays: 3,
            dailyRate: "25.00",
            totalAmount: "80.00",
            securityDeposit: "0.00",
            deliveryRequested: false,
            deliveryFee: "0.00",
            pickupAddress: "9 Oak Ave",
            setupRequested: false,
            setupFee: "0.00",
            serviceFee: "5.00",
            status: "approved",
          } as RentalDetailsInfo
        }
        isOwner={false}
      />,
    );

    expect(
      screen.getByText(new Date(2026, 9, 27).toLocaleDateString()),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new Date(2026, 9, 29).toLocaleDateString()),
    ).toBeInTheDocument();
  });
});

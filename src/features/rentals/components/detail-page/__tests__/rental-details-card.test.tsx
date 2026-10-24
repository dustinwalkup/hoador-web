import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { RentalDetailsInfo } from "@/dal/rentals.dal";

vi.mock("@/components/payments/how-payments-work-modal", () => ({
  HowPaymentsWorkModal: () => null,
}));

import { RentalDetailsCard } from "../rental-details-card";

function details(
  overrides: Partial<RentalDetailsInfo> = {},
): RentalDetailsInfo {
  return {
    startDate: new Date("2026-10-27T00:00:00.000Z"),
    endDate: new Date("2026-10-28T00:00:00.000Z"),
    totalDays: 2,
    dailyRate: "25.00",
    totalAmount: "57.50",
    securityDeposit: "0.00",
    deliveryRequested: true,
    deliveryAddress: undefined,
    deliveryInstructions: null,
    deliveryFee: "5.00",
    pickupAddress: "9 Oak Ave",
    setupRequested: false,
    setupFee: "0.00",
    serviceFee: "2.50",
    selectedWindow: undefined,
    pickupInstructions: undefined,
    returnInstructions: undefined,
    status: "pending",
    ...overrides,
  } as RentalDetailsInfo;
}

/**
 * PRIV-01 withholds the renter's delivery address from the owner until they
 * accept. "Address not specified" read as if the renter had left it out.
 */
describe("RentalDetailsCard — delivery address", () => {
  it("tells the owner of a pending delivery request when the address arrives", () => {
    render(<RentalDetailsCard rentalDetails={details()} isOwner />);

    expect(
      screen.getByText("The renter's address is shared once you accept."),
    ).toBeTruthy();
    expect(screen.queryByText("Address not specified")).toBeNull();
    expect(screen.queryByText("9 Oak Ave")).toBeNull();
  });

  it("shows the address once the owner has accepted", () => {
    render(
      <RentalDetailsCard
        rentalDetails={details({
          status: "approved",
          deliveryAddress: "12 Elm St",
        })}
        isOwner
      />,
    );

    expect(screen.getByText("12 Elm St")).toBeTruthy();
    expect(screen.queryByText(/shared once you accept/)).toBeNull();
  });

  it("shows the renter their own delivery address while pending", () => {
    render(
      <RentalDetailsCard
        rentalDetails={details({ deliveryAddress: "12 Elm St" })}
        isOwner={false}
      />,
    );

    expect(screen.getByText("12 Elm St")).toBeTruthy();
  });
});

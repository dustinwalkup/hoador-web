import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const lifecycle = {
  rentalChargeId: null,
  depositHoldStatus: "not_applicable",
  depositHoldPlacedAt: null,
  depositReleasedAt: null,
  depositCapturedAt: null,
  ownerTransferStatus: "pending",
  ownerTransferredAt: null,
  stripeTransferId: null,
  payoutStatus: "pending",
  createdAt: new Date("2026-10-21T15:00:00.000Z"),
  updatedAt: new Date("2026-10-21T15:00:00.000Z"),
};

vi.mock("@/features/admin/hooks/use-payment-lifecycle", () => ({
  usePaymentLifecycleDetail: () => ({
    isLoading: false,
    error: null,
    data: {
      lifecycle,
      rental: {
        rentalId: "rental-1",
        // Booked days as the browser receives them: a mobile-stored Oct 27.
        startDate: new Date("2026-10-27T00:00:00.000Z"),
        endDate: new Date("2026-10-29T00:00:00.000Z"),
        returnConfirmedAt: null,
        totalAmount: "80.00",
        securityDeposit: "0.00",
      },
      dispute: null,
      auditLogEntries: [],
    },
  }),
}));
vi.mock("@/features/admin/hooks/use-payment-lifecycle-mutations", () => ({
  useResetPayoutStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useResetTransferStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useReleaseDeposit: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { PaymentLifecycleDetailClient } from "../payment-lifecycle-detail-client";

/**
 * HOA-124: the rental's dates are booked days. Formatted as instants, a
 * mobile-stored Oct 27 read as "10/26/26, 7:00 PM" in a Central browser.
 */
describe("PaymentLifecycleDetailClient — booked days", () => {
  it("shows the booked dates, with no time of day", () => {
    render(<PaymentLifecycleDetailClient rentalId="rental-1" />);

    const short = (d: Date) =>
      d.toLocaleDateString(undefined, { dateStyle: "short" });
    expect(
      screen.getByText(
        `${short(new Date(2026, 9, 27))} – ${short(new Date(2026, 9, 29))}`,
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Rental through ${short(new Date(2026, 9, 29))}`),
    ).toBeInTheDocument();
  });
});

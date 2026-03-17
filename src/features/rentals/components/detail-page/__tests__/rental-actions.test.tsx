import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { RentalActions } from "../rental-actions";
import type { RentalActionsInfo } from "@/dal/rentals.dal";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock(
  "@/features/rentals/components/renting-lending/cancel-request-dialog",
  () => ({
    CancelRequestDialog: () => null,
  }),
);

vi.mock("@/features/rentals/components/renting-lending", () => ({
  ApproveRequestDialog: () => null,
  CancelApprovedRentalDialog: () => null,
  DeclineRequestDialog: () => null,
  UpdateInstructionsDialog: () => null,
  StartRentalDialog: () => null,
  EndRentalDialog: () => null,
}));

vi.mock("@/features/reviews/components/leave-review-modal", () => ({
  LeaveReviewModal: () => null,
}));

vi.mock("@/features/disputes/components/file-dispute-dialog", () => ({
  FileDisputeDialog: () => null,
}));

function baseRentalDetails(
  overrides: Partial<RentalActionsInfo> = {},
): RentalActionsInfo {
  return {
    id: "req-1",
    listingId: "listing-1",
    listingName: "Test Listing",
    renterName: "Jane Doe",
    status: "completed",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-07"),
    pickupInstructions: undefined,
    returnInstructions: undefined,
    deliveryRequested: false,
    hasReview: false,
    canLeaveReview: false,
    returnConfirmedAt: undefined,
    ...overrides,
  };
}

describe("RentalActions canFileDispute", () => {
  it("approved + past startDate → File Dispute visible", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "approved", startDate })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /file dispute/i }),
    ).toBeInTheDocument();
  });

  it("approved + before startDate → File Dispute hidden", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "approved", startDate })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("active → File Dispute visible", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "active", startDate })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /file dispute/i }),
    ).toBeInTheDocument();
  });

  it("completed + within 24h of returnConfirmedAt → File Dispute visible", () => {
    const returnConfirmedAt = new Date();
    returnConfirmedAt.setHours(returnConfirmedAt.getHours() - 12);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({
          status: "completed",
          startDate,
          returnConfirmedAt,
        })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /file dispute/i }),
    ).toBeInTheDocument();
  });

  it("completed + no returnConfirmedAt → File Dispute hidden", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({
          status: "completed",
          startDate,
          returnConfirmedAt: undefined,
        })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("completed + 25h after returnConfirmedAt → File Dispute hidden", () => {
    const returnConfirmedAt = new Date();
    returnConfirmedAt.setHours(returnConfirmedAt.getHours() - 25);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({
          status: "completed",
          startDate,
          returnConfirmedAt,
        })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("pending → File Dispute hidden", () => {
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "pending" })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("cancelled → File Dispute hidden", () => {
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "cancelled" })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("denied → File Dispute hidden", () => {
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "denied" })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("active dispute exists → File Dispute hidden", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "active", startDate })}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
        activeDispute={{ id: "dsp-1", status: "open" } as any}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });

  it("user is neither renter nor owner → File Dispute hidden", () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({ status: "active", startDate })}
        viewContext="auto"
        isRenter={false}
        isOwner={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /file dispute/i }),
    ).not.toBeInTheDocument();
  });
});

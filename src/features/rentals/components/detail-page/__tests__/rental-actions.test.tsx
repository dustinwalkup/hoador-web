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

const mockFileDisputeDialog = vi.fn();
vi.mock("@/features/disputes/components/file-dispute-dialog", () => ({
  FileDisputeDialog: (props: unknown) => {
    mockFileDisputeDialog(props);
    return null;
  },
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

  // HOA-124: a rental dispute opens when the pickup day starts in Central
  // (`pickupInstant`, computed by the server and handed down), not at the
  // instant the stored day parses to, which for a mobile-stored day is 7pm
  // Central the evening before.
  describe("opens at the server's start of the pickup day", () => {
    const yesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    };
    const hoursFromNow = (h: number) =>
      new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

    it("hides File Dispute until then, whatever the stored start says", () => {
      render(
        <RentalActions
          rentalDetails={baseRentalDetails({
            status: "approved",
            startDate: yesterday(),
          })}
          disputeOpensAt={hoursFromNow(3)}
          viewContext="renting"
          isRenter={true}
          isOwner={false}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /file dispute/i }),
      ).not.toBeInTheDocument();
    });

    it("shows it once that instant has passed", () => {
      render(
        <RentalActions
          rentalDetails={baseRentalDetails({
            status: "approved",
            startDate: yesterday(),
          })}
          disputeOpensAt={hoursFromNow(-1)}
          viewContext="renting"
          isRenter={true}
          isOwner={false}
        />,
      );
      expect(
        screen.getByRole("button", { name: /file dispute/i }),
      ).toBeInTheDocument();
    });

    // The form offers the no-show reasons from the same instant.
    it("hands the dispute form the same instant as the rental's start", () => {
      const opensAt = hoursFromNow(-1);
      render(
        <RentalActions
          rentalDetails={baseRentalDetails({
            status: "approved",
            startDate: yesterday(),
          })}
          disputeOpensAt={opensAt}
          viewContext="renting"
          isRenter={true}
          isOwner={false}
        />,
      );
      expect(mockFileDisputeDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: new Date(opensAt) }),
      );
    });
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

/**
 * Flow 6: the rental's own agreement PDF lands a few seconds after approval.
 * Until then the page has only the generic terms; just after approval the
 * button says the agreement is being prepared instead of opening the terms
 * as this rental's agreement, and the page refreshes itself meanwhile.
 */
describe("RentalActions — agreement just after approval", () => {
  it("says the agreement is being prepared, not ready", () => {
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({
          status: "approved",
          approvedAt: new Date(Date.now() - 5_000),
        })}
        rentalAgreementUrl="https://legal.example.com/terms.pdf"
        rentalAgreementGenerated={false}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );

    const button = screen.getByRole("button", {
      name: /preparing rental agreement/i,
    });
    expect(button).toBeDisabled();
  });

  it("offers the agreement once it is the rental's own", () => {
    render(
      <RentalActions
        rentalDetails={baseRentalDetails({
          status: "approved",
          approvedAt: new Date(Date.now() - 5_000),
        })}
        rentalAgreementUrl="https://blob.example.com/req-1.pdf"
        rentalAgreementGenerated={true}
        viewContext="renting"
        isRenter={true}
        isOwner={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^rental agreement$/i }),
    ).toBeEnabled();
  });
});

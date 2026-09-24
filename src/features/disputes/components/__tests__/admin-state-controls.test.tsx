import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminStateControls } from "../admin-state-controls";

/**
 * BIZ-05: the State Management panel used to offer "Resolve", which set the
 * status through PATCH /state and skipped the deposit and the owner's
 * transfer. Resolution lives in the resolution panel only.
 */

const mockUseDispute = vi.fn();
vi.mock("../../hooks", () => ({
  useDispute: (...a: unknown[]) => mockUseDispute(...a),
  useUpdateDisputeState: () => ({ mutate: vi.fn(), isPending: false }),
}));

const withStatus = (status: string) =>
  mockUseDispute.mockReturnValue({ data: { id: "dispute-1", status } });

describe("AdminStateControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["open", "evidence_requested", "under_review"])(
    "offers no way to resolve a %s dispute",
    (status) => {
      withStatus(status);

      render(<AdminStateControls disputeId="dispute-1" />);

      expect(
        screen.queryByRole("button", { name: /resolve/i }),
      ).not.toBeInTheDocument();
    },
  );

  it("still offers the escalations for an open dispute", () => {
    withStatus("open");

    render(<AdminStateControls disputeId="dispute-1" />);

    expect(
      screen.getByRole("button", { name: "Request Evidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move to Review" }),
    ).toBeInTheDocument();
  });

  it("still offers Under Review for an evidence_requested dispute", () => {
    withStatus("evidence_requested");

    render(<AdminStateControls disputeId="dispute-1" />);

    expect(
      screen.getByRole("button", { name: /under review/i }),
    ).toBeInTheDocument();
  });
});

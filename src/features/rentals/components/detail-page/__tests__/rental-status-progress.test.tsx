import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { RentalStatusProgress } from "../rental-status-progress";

/**
 * HOA-124: the timeline's date under "Active" / "Completed" is a BOOKED DAY.
 * It reaches the browser as the instant the server's driver parsed it to: an
 * Oct 27 day stored by mobile is 2026-10-27T00:00Z, which a Central browser
 * read as Oct 26 at 7pm. It must say Oct 27 in any browser zone, and the amber
 * "start passed" warning must wait for the start of that day in Central.
 */
const renderApproved = () =>
  render(
    <RentalStatusProgress
      currentStatus="approved"
      userRole="renter"
      rentalId="req-1"
      deliveryRequested={false}
      startDate={new Date("2026-10-27T00:00:00Z")}
      endDate={new Date("2026-10-29T00:00:00Z")}
      createdAt={new Date("2026-10-20T15:00:00Z")}
      approvedAt={new Date("2026-10-21T15:00:00Z")}
    />,
  );

describe("RentalStatusProgress — booked-day labels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels the start with the booked day, not the browser's reading of it", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T17:00:00Z"));

    renderApproved();

    expect(screen.getByText("Oct 27")).toBeInTheDocument();
    expect(screen.queryByText("Oct 26")).not.toBeInTheDocument();
  });

  it("does not warn at 8pm Central the evening before", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T01:00:00Z"));

    renderApproved();

    expect(screen.getByText("Oct 27")).not.toHaveClass("text-amber-600");
  });

  it("warns once the pickup day has started in Central", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T05:00:00Z"));

    renderApproved();

    expect(screen.getByText("Oct 27")).toHaveClass("text-amber-600");
  });
});

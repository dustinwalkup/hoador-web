import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithQueryClient } from "@/test/utils/render-helpers";
import { formatDateTimeLocal } from "@/lib/utils/date.utils";

const mockMutateAsync = vi.fn();
vi.mock("@/features/rentals/hooks/use-rental-mutations", () => ({
  useCancelRentalRequest: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { CancelApprovedRentalDialog } from "../cancel-approved-rental-dialog";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const respond = (body: Record<string, unknown>, ok = true) =>
  mockFetch.mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });

const renderDialog = () =>
  renderWithQueryClient(
    <CancelApprovedRentalDialog
      open
      onOpenChange={vi.fn()}
      requestId="req-1"
      listingName="Cordless drill"
    />,
  );

/**
 * HOA-124: the web dialog used to pick the refund sentence itself, from
 * `startDate` and the browser's clock, 24 hours before UTC midnight. The server
 * measures from the start of the pickup day in Central, so for five hours every
 * evening the dialog promised one tier and the server applied the other. It now
 * says what the server's cancellation preview says.
 */
describe("CancelApprovedRentalDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks the server what the refund is", async () => {
    respond({ canCancel: true, tier: "full_refund_24h" });

    renderDialog();

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rentals/req-1/cancellation-preview",
      ),
    );
  });

  it("describes the server's full-refund tier and when it ends", async () => {
    const tierExpiresAt = "2026-10-26T05:00:00.000Z";
    respond({ canCancel: true, tier: "full_refund_24h", tierExpiresAt });

    renderDialog();

    expect(
      await screen.findByText(/full refund of the rental price/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `This refund applies until ${formatDateTimeLocal(tierExpiresAt)}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/50% refund/i)).not.toBeInTheDocument();
  });

  it("describes the server's half-refund tier", async () => {
    respond({
      canCancel: true,
      tier: "half_refund_under_24h",
      tierExpiresAt: null,
    });

    renderDialog();

    expect(await screen.findByText(/50% refund/i)).toBeInTheDocument();
    expect(screen.queryByText(/applies until/i)).not.toBeInTheDocument();
  });

  // The server knows who is cancelling; the dialog no longer needs telling.
  it("tells the owner the renter is refunded in full", async () => {
    respond({ canCancel: true, tier: "owner_cancellation" });

    renderDialog();

    expect(
      await screen.findByText(/full refund including the service fee/i),
    ).toBeInTheDocument();
  });

  // Req 9.3.1: no tier on screen, no confirm.
  it("does not offer the cancel button until the refund is known", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderDialog();

    expect(screen.getByText(/checking your refund/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel rental/i }),
    ).toBeDisabled();
  });

  it("says so, and keeps the button off, when the refund cannot be checked", async () => {
    respond({ error: "boom" }, false);

    renderDialog();

    expect(
      await screen.findByText(/couldn.t check your refund/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel rental/i }),
    ).toBeDisabled();
  });

  const reply = (body: Record<string, unknown>) => ({
    ok: true,
    json: () => Promise.resolve(body),
  });
  const dialog = (open: boolean) => (
    <CancelApprovedRentalDialog
      open={open}
      onOpenChange={vi.fn()}
      requestId="req-1"
      listingName="Cordless drill"
    />
  );
  const confirmButton = () =>
    screen.getByRole("button", { name: /cancel rental/i });

  // A quote is a snapshot of a tier that changes at a cutoff. Reopening the
  // dialog must not show the last open's "full refund" with Confirm live.
  it("fetches a fresh quote on every open, Confirm off until it lands", async () => {
    mockFetch.mockResolvedValueOnce(
      reply({ canCancel: true, tier: "full_refund_24h" }),
    );
    const { rerender } = renderWithQueryClient(dialog(true));
    expect(
      await screen.findByText(/full refund of the rental price/i),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/reason for cancellation/i), {
      target: { value: "Plans changed" },
    });
    expect(confirmButton()).toBeEnabled();

    rerender(dialog(false));
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    rerender(dialog(true));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/checking your refund/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/full refund of the rental price/i),
    ).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("asks again when the quoted tier expires while the dialog is open", async () => {
    mockFetch
      .mockResolvedValueOnce(
        reply({
          canCancel: true,
          tier: "full_refund_24h",
          tierExpiresAt: new Date(Date.now() + 200).toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        reply({
          canCancel: true,
          tier: "half_refund_under_24h",
          tierExpiresAt: null,
        }),
      );

    renderWithQueryClient(dialog(true));

    expect(
      await screen.findByText(/full refund of the rental price/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/50% refund/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

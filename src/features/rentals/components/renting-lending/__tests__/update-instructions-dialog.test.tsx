import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockMutateAsync = vi.fn();
vi.mock("@/features/rentals/hooks/use-rental-mutations", () => ({
  useUpdateRentalInstructions: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { UpdateInstructionsDialog } from "../update-instructions-dialog";

const renderDialog = (
  props: Partial<Parameters<typeof UpdateInstructionsDialog>[0]> = {},
) =>
  render(
    <UpdateInstructionsDialog
      open
      onOpenChange={vi.fn()}
      rentalId="req-1"
      listingName="Pressure washer"
      currentPickupInstructions="Side gate."
      currentReturnInstructions="Porch."
      {...props}
    />,
  );

/**
 * The approve dialog asks for no pickup details on a delivery: the owner
 * brings the item over, so there is nothing to collect. Editing them later
 * must not ask either (mobile does the same).
 */
describe("UpdateInstructionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
  });

  it("asks for pickup and return instructions on a pickup rental", () => {
    renderDialog({ deliveryRequested: false });

    expect(screen.getByLabelText(/Pickup Instructions/)).toBeTruthy();
    expect(screen.getByLabelText(/Return Instructions/)).toBeTruthy();
    expect(
      screen.getByText(/Update the pickup and return instructions/),
    ).toBeTruthy();
  });

  it("asks only for return instructions on a delivery rental", () => {
    renderDialog({ deliveryRequested: true, currentPickupInstructions: null });

    expect(screen.queryByLabelText(/Pickup Instructions/)).toBeNull();
    expect(screen.getByLabelText(/Return Instructions/)).toBeTruthy();
    expect(screen.getByText(/Update the return instructions/)).toBeTruthy();
    expect(screen.queryByText(/pickup/i)).toBeNull();
  });

  // The update writes both columns, so the hidden field still sends what it
  // holds rather than blanking it.
  it("keeps the stored pickup instructions when saving a delivery rental", async () => {
    renderDialog({ deliveryRequested: true });

    fireEvent.change(screen.getByLabelText(/Return Instructions/), {
      target: { value: "I'll collect it from the porch." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Update Instructions" }),
    );

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        rentalId: "req-1",
        pickupInstructions: "Side gate.",
        returnInstructions: "I'll collect it from the porch.",
      }),
    );
  });
});

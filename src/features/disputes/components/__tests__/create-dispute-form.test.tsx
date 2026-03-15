import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateDisputeFormContent } from "../create-dispute-form";

const mockMutateAsync = vi.fn();
vi.mock("../../hooks/use-create-dispute", () => ({
  useCreateDispute: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("CreateDisputeFormContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows no-show reason codes when status=approved and past startDate", async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <CreateDisputeFormContent
        rentalId="rental-1"
        rentalStatus="approved"
        startDate={startDate}
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    expect(
      screen.getByRole("option", { name: /renter no-show/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /owner no-show/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /damage/i })).toBeInTheDocument();
  });

  it("does not show no-show codes when status=completed", async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    render(
      <CreateDisputeFormContent
        rentalId="rental-1"
        rentalStatus="completed"
        startDate={startDate}
      />,
    );
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    expect(
      screen.queryByRole("option", { name: /renter no-show/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /owner no-show/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /damage/i })).toBeInTheDocument();
  });

  it("shows all base reason codes (damage, non_delivery, etc.)", async () => {
    render(<CreateDisputeFormContent rentalId="rental-1" />);
    const trigger = screen.getByRole("combobox");
    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: /damage/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /non-delivery/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /quality issue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /cancellation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /payment issue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^other$/i }),
    ).toBeInTheDocument();
  });
});

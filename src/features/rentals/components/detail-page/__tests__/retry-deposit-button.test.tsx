import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetryDepositButton } from "../retry-deposit-button";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("RetryDepositButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the retry button", () => {
    render(<RetryDepositButton rentalId="rental-1" />);

    expect(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    ).toBeInTheDocument();
  });

  it("shows loading state while retrying", async () => {
    const user = userEvent.setup();
    // Never-resolving fetch to keep loading state
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );

    render(<RetryDepositButton rentalId="rental-1" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    expect(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    ).toBeDisabled();
  });

  it("shows success message and refreshes router on success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    render(<RetryDepositButton rentalId="rental-1" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/deposit hold placed successfully/i),
      ).toBeInTheDocument();
    });
    expect(mockRefresh).toHaveBeenCalled();
    // Button should no longer be visible
    expect(
      screen.queryByRole("button", { name: /retry deposit hold/i }),
    ).not.toBeInTheDocument();
  });

  it("shows error message from API on failure", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: false, error: "Card was declined" }),
    });

    render(<RetryDepositButton rentalId="rental-1" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Card was declined")).toBeInTheDocument();
    });
    // Button should still be visible for retry
    expect(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    ).toBeInTheDocument();
  });

  it("shows fallback error when API returns no error message", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });

    render(<RetryDepositButton rentalId="rental-1" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to place deposit hold"),
      ).toBeInTheDocument();
    });
  });

  it("shows generic error on network failure", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<RetryDepositButton rentalId="rental-1" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("POSTs to the correct API endpoint", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    render(<RetryDepositButton rentalId="rental-42" />);

    await user.click(
      screen.getByRole("button", { name: /retry deposit hold/i }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/rentals/rental-42/retry-deposit",
      { method: "POST" },
    );
  });

  it("re-enables button after failed attempt", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: "Declined" }),
    });

    render(<RetryDepositButton rentalId="rental-1" />);
    const button = screen.getByRole("button", { name: /retry deposit hold/i });

    await user.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});

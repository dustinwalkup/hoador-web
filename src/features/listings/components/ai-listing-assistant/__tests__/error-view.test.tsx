import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type AiFailureReason } from "@/features/listings/ai-listing-assistant/types";

import { ErrorView } from "../error-view";

function renderView(reason: AiFailureReason) {
  const handlers = {
    onTryAgain: vi.fn(),
    onAddMorePhotos: vi.fn(),
    onContinueManually: vi.fn(),
  };
  const utils = render(<ErrorView reason={reason} {...handlers} />);
  return { ...utils, ...handlers };
}

describe("ErrorView", () => {
  it("renders all three recovery options for low_confidence (Req 9.2)", () => {
    renderView("low_confidence");
    expect(screen.getByTestId("ai-modal-error-add-photos")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-error-retry")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-modal-error-continue-manually"),
    ).toBeInTheDocument();
  });

  it("offers Try Again and Continue Manually for a network error", () => {
    renderView("network");
    expect(screen.getByTestId("ai-modal-error-retry")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-modal-error-continue-manually"),
    ).toBeInTheDocument();
    // No "Add photos" — that's a low-confidence-specific affordance.
    expect(
      screen.queryByTestId("ai-modal-error-add-photos"),
    ).not.toBeInTheDocument();
  });

  it("offers Try Again and Continue Manually for a server error", () => {
    renderView("server");
    expect(screen.getByTestId("ai-modal-error-retry")).toBeInTheDocument();
    expect(
      screen.getByTestId("ai-modal-error-continue-manually"),
    ).toBeInTheDocument();
  });

  it("for rate_limited, only Continue Manually is offered (Req 9.2)", () => {
    renderView("rate_limited");
    expect(
      screen.queryByTestId("ai-modal-error-retry"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ai-modal-error-add-photos"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("ai-modal-error-continue-manually"),
    ).toBeInTheDocument();
  });

  it("fires the correct callback per action", async () => {
    const { onTryAgain, onAddMorePhotos, onContinueManually } =
      renderView("low_confidence");

    await userEvent.click(screen.getByTestId("ai-modal-error-add-photos"));
    expect(onAddMorePhotos).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByTestId("ai-modal-error-retry"));
    expect(onTryAgain).toHaveBeenCalledOnce();

    await userEvent.click(
      screen.getByTestId("ai-modal-error-continue-manually"),
    );
    expect(onContinueManually).toHaveBeenCalledOnce();
  });

  it.each<AiFailureReason>([
    "low_confidence",
    "network",
    "rate_limited",
    "server",
  ])("avoids technical/AI jargon in %s copy (Req 6.3 / 9.1)", (reason) => {
    renderView(reason);
    const root = screen.getByTestId("ai-modal-error");
    const text = root.textContent ?? "";
    expect(text).not.toMatch(/OpenAI/i);
    expect(text).not.toMatch(/gpt-?4/i);
    expect(text).not.toMatch(/inference/i);
    expect(text).not.toMatch(/HTTP\s*\d/i);
    expect(text).not.toMatch(/\b5\d\d\b/);
  });

  it("uses distinct copy for each reason", () => {
    const titles = new Set<string>();
    for (const reason of [
      "low_confidence",
      "network",
      "rate_limited",
      "server",
    ] as const) {
      const { unmount } = renderView(reason);
      titles.add(screen.getByTestId("ai-modal-error-title").textContent ?? "");
      unmount();
    }
    expect(titles.size).toBe(4);
  });
});

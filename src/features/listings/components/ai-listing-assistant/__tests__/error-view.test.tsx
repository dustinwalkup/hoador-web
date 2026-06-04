import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  type AiFailureReason,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";

import { ErrorView } from "../error-view";

function fakePhoto(id: string, name = `${id}.jpg`): StagedPhoto {
  return {
    id,
    file: new File([new Uint8Array([1])], name, { type: "image/jpeg" }),
    previewUrl: `blob:${name}`,
    dataUrl: "",
  };
}

function renderView(reason: AiFailureReason, staged: StagedPhoto[] = []) {
  const handlers = {
    onRemovePhoto: vi.fn(),
    onTryAgain: vi.fn(),
    onAddMorePhotos: vi.fn(),
    onContinueManually: vi.fn(),
  };
  const utils = render(
    <ErrorView reason={reason} staged={staged} {...handlers} />,
  );
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
    const { onTryAgain, onAddMorePhotos, onContinueManually } = renderView(
      "low_confidence",
      [fakePhoto("p1")],
    );

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
    "unsuitable_content",
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
      "unsuitable_content",
      "network",
      "rate_limited",
      "server",
    ] as const) {
      const { unmount } = renderView(reason);
      titles.add(screen.getByTestId("ai-modal-error-title").textContent ?? "");
      unmount();
    }
    expect(titles.size).toBe(5);
  });

  describe("inline photo grid (post-failure pruning)", () => {
    it("renders staged photos with remove buttons on low_confidence", () => {
      renderView("low_confidence", [fakePhoto("p1"), fakePhoto("p2")]);
      expect(screen.getByTestId("ai-modal-error-photos")).toBeInTheDocument();
      expect(
        screen.getByTestId("ai-modal-error-remove-photo-p1"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("ai-modal-error-remove-photo-p2"),
      ).toBeInTheDocument();
    });

    it("renders staged photos with remove buttons on unsuitable_content", () => {
      renderView("unsuitable_content", [fakePhoto("p1")]);
      expect(screen.getByTestId("ai-modal-error-photos")).toBeInTheDocument();
    });

    it.each<AiFailureReason>(["network", "rate_limited", "server"])(
      "does NOT render the photo grid for %s (not a photo-related failure)",
      (reason) => {
        renderView(reason, [fakePhoto("p1")]);
        expect(
          screen.queryByTestId("ai-modal-error-photos"),
        ).not.toBeInTheDocument();
      },
    );

    it("omits the grid when there are no staged photos to show", () => {
      renderView("low_confidence", []);
      expect(
        screen.queryByTestId("ai-modal-error-photos"),
      ).not.toBeInTheDocument();
    });

    it("fires onRemovePhoto with the photo id when its X is clicked", async () => {
      const { onRemovePhoto } = renderView("unsuitable_content", [
        fakePhoto("p1"),
        fakePhoto("p2"),
      ]);
      await userEvent.click(
        screen.getByTestId("ai-modal-error-remove-photo-p1"),
      );
      expect(onRemovePhoto).toHaveBeenCalledExactlyOnceWith("p1");
    });

    it("labels retry as 'Generate again' when staged photos are visible", () => {
      renderView("low_confidence", [fakePhoto("p1")]);
      expect(screen.getByTestId("ai-modal-error-retry")).toHaveTextContent(
        "Generate again",
      );
    });

    it("labels retry as 'Try again' for non-photo failures", () => {
      renderView("network");
      expect(screen.getByTestId("ai-modal-error-retry")).toHaveTextContent(
        "Try again",
      );
    });

    it("disables retry when all photos have been removed", () => {
      renderView("low_confidence", []);
      expect(screen.getByTestId("ai-modal-error-retry")).toBeDisabled();
    });

    it("enables retry while at least one photo remains staged", () => {
      renderView("low_confidence", [fakePhoto("p1")]);
      expect(screen.getByTestId("ai-modal-error-retry")).not.toBeDisabled();
    });
  });
});

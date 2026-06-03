import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";

import { AIListingAssistantModal } from "../ai-listing-assistant-modal";

const emitMock = vi.fn();
vi.mock("@/features/listings/ai-listing-assistant/lib/telemetry", () => ({
  emitAiEvent: (...args: unknown[]) => emitMock(...args),
}));

type Captured = {
  onSuccess: (d: AiDraft) => void;
  onFailure: (
    r: "rate_limited" | "network" | "server" | "low_confidence",
  ) => void;
};
const captured: { last: Captured | null; generate: Mock } = {
  last: null,
  generate: vi.fn(),
};
vi.mock("@/features/listings/hooks/use-analyze-listing-draft", () => ({
  useAnalyzeListingDraft: (args: Captured) => {
    captured.last = args;
    return { isPending: false, generate: captured.generate };
  },
}));

const SAMPLE_DRAFT: AiDraft = {
  name: "DeWalt 20V Cordless Drill",
  description: "Solid cordless drill.",
  categoryId: "uuid-power-tools",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "good",
  specifications: { power: "20V MAX" },
  instructions: null,
  safetyNotes: null,
};

function renderModal(open = true) {
  return render(
    <AIListingAssistantModal
      open={open}
      onManualSelected={vi.fn()}
      onCancelFromAi={vi.fn()}
      onGenerated={vi.fn()}
    />,
  );
}

function click(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
}
function uploadFiles(files: File[]) {
  const input = screen.getByTestId("ai-modal-file-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}
function fakeFile(name: string) {
  return new File([new Uint8Array([1])], name, { type: "image/jpeg" });
}

function eventsByName(name: string) {
  return emitMock.mock.calls.filter((c) => c[0] === name);
}

beforeEach(() => {
  emitMock.mockReset();
  captured.last = null;
  captured.generate.mockReset();
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.stubGlobal(
    "URL",
    Object.assign(globalThis.URL, {
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AIListingAssistantModal — telemetry", () => {
  it("emits listing_create_modal_opened exactly once on first open (Req 12)", () => {
    renderModal();
    const opened = eventsByName("listing_create_modal_opened");
    expect(opened).toHaveLength(1);
    expect(opened[0][1]).toEqual({ entryPath: "create_listing_page" });
  });

  it("does not emit modal_opened when rendered with open=false", () => {
    renderModal(false);
    expect(eventsByName("listing_create_modal_opened")).toHaveLength(0);
  });

  it("emits listing_create_choice_selected with the picked choice", () => {
    renderModal();
    click("ai-modal-choice-ai");
    const ai = eventsByName("listing_create_choice_selected");
    expect(ai).toHaveLength(1);
    expect(ai[0][1]).toEqual({ choice: "ai" });
  });

  it("emits choice=manual when the Manual button is clicked", () => {
    renderModal();
    click("ai-modal-choice-manual");
    expect(eventsByName("listing_create_choice_selected")[0][1]).toEqual({
      choice: "manual",
    });
  });

  it("emits listing_ai_photos_staged with the running count when files are added", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg"), fakeFile("b.jpg")]);

    const staged = eventsByName("listing_ai_photos_staged");
    expect(staged).toHaveLength(1);
    expect(staged[0][1]).toEqual({ count: 2 });

    uploadFiles([fakeFile("c.jpg")]);
    expect(eventsByName("listing_ai_photos_staged")).toHaveLength(2);
    expect(eventsByName("listing_ai_photos_staged")[1][1]).toEqual({
      count: 3,
    });
  });

  it("emits listing_ai_photos_staged with the new count when a photo is removed", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg"), fakeFile("b.jpg")]);
    emitMock.mockClear();

    const removeBtn = screen
      .getByTestId("ai-modal-staged-photos")
      .querySelector(
        '[data-testid^="ai-modal-remove-photo-"]',
      ) as HTMLButtonElement;
    fireEvent.click(removeBtn);

    const staged = eventsByName("listing_ai_photos_staged");
    expect(staged).toHaveLength(1);
    expect(staged[0][1]).toEqual({ count: 1 });
  });

  it("emits listing_ai_generation_started with the photo count on Generate click", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg"), fakeFile("b.jpg")]);
    emitMock.mockClear();

    click("ai-modal-generate");

    const started = eventsByName("listing_ai_generation_started");
    expect(started).toHaveLength(1);
    expect(started[0][1]).toEqual({ photoCount: 2 });
  });

  it("emits listing_ai_generation_succeeded with prefilled-field metadata", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    emitMock.mockClear();

    act(() => captured.last?.onSuccess(SAMPLE_DRAFT));

    const succeeded = eventsByName("listing_ai_generation_succeeded");
    expect(succeeded).toHaveLength(1);
    const payload = succeeded[0][1] as Record<string, unknown>;
    expect(payload.photoCount).toBe(1);
    expect(payload.categoryResolved).toBe(true);
    expect(payload.conditionResolved).toBe(true);
    expect(payload.prefilledFields).toContain("name");
    expect(payload.prefilledFields).toContain("brand");
    expect(payload.prefilledFields).not.toContain("instructions");
    expect(payload.prefilledFields).not.toContain("safetyNotes");
  });

  it("emits listing_ai_generation_failed with the reason", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    emitMock.mockClear();

    act(() => captured.last?.onFailure("rate_limited"));

    const failed = eventsByName("listing_ai_generation_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0][1]).toEqual({ photoCount: 1, reason: "rate_limited" });
  });

  it("emits listing_ai_continue_manually_after_failure only from the error state", async () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    act(() => captured.last?.onFailure("network"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    emitMock.mockClear();

    click("ai-modal-error-continue-manually");

    const continued = eventsByName(
      "listing_ai_continue_manually_after_failure",
    );
    expect(continued).toHaveLength(1);
    expect(continued[0][1]).toEqual({ reason: "network" });
  });

  it("does NOT emit continue_manually_after_failure when cancelling from instructions", () => {
    renderModal();
    click("ai-modal-choice-ai");
    uploadFiles([fakeFile("a.jpg")]);
    emitMock.mockClear();

    click("ai-modal-cancel");

    expect(
      eventsByName("listing_ai_continue_manually_after_failure"),
    ).toHaveLength(0);
  });
});

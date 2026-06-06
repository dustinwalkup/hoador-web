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
import { PROCESSING_STEPS } from "../processing-view";

// Mock the analyze hook so we can drive success/failure deterministically
// without timing the real network path.
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

// Default to a pass-through processor so the existing JPEG-based tests don't
// hit the real canvas-based compressImage (unreliable under happy-dom). Tests
// that need to assert HEIC conversion or error surfacing override per-call.
type ProcessOutput = {
  files: File[];
  errors: {
    fileName: string;
    reason: "too-large" | "invalid-type" | "conversion-failed";
    message: string;
    fileSize?: number;
  }[];
  heicConversionCount: number;
};
const processSelectedFilesMock = vi.fn<
  (files: File[] | FileList) => Promise<ProcessOutput>
>(async (files) => ({
  files: Array.from(files),
  errors: [],
  heicConversionCount: 0,
}));
vi.mock("@/lib/image/process-selected-files", () => ({
  processSelectedFiles: (files: File[] | FileList) =>
    processSelectedFilesMock(files),
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

function renderModal(
  overrides: Partial<React.ComponentProps<typeof AIListingAssistantModal>> = {},
) {
  const props = {
    open: true,
    onManualSelected: vi.fn(),
    onCancelFromAi: vi.fn(),
    onGenerated: vi.fn(),
    ...overrides,
  };
  const utils = render(<AIListingAssistantModal {...props} />);
  // Cast callbacks back to Mock so tests can inspect `.mock.calls`. The spread
  // above widens them to a function union which TS can't unwrap.
  return {
    ...utils,
    ...props,
    onManualSelected: props.onManualSelected as Mock,
    onCancelFromAi: props.onCancelFromAi as Mock,
    onGenerated: props.onGenerated as Mock,
  };
}

function click(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
}

async function uploadFiles(files: File[]) {
  const input = screen.getByTestId("ai-modal-file-input") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    fireEvent.change(input);
  });
}

function fakeFile(name: string): File {
  return new File([new Uint8Array([1])], name, { type: "image/jpeg" });
}

beforeEach(() => {
  // Fake setTimeout/clearTimeout only — leaving requestAnimationFrame alone
  // so Radix Dialog's focus management (which uses rAF) doesn't deadlock
  // with happy-dom under fake timers.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  captured.last = null;
  captured.generate.mockReset();
  processSelectedFilesMock.mockReset();
  processSelectedFilesMock.mockImplementation(
    async (files: File[] | FileList) => ({
      files: Array.from(files),
      errors: [],
      heicConversionCount: 0,
    }),
  );
  // URL.createObjectURL isn't implemented by happy-dom by default.
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
  vi.restoreAllMocks();
});

describe("AIListingAssistantModal", () => {
  it("opens in the Choice state when open=true", () => {
    renderModal();
    expect(screen.getByTestId("ai-modal-choice")).toBeInTheDocument();
  });

  it("renders nothing when open=false", () => {
    renderModal({ open: false });
    expect(screen.queryByTestId("ai-modal-choice")).not.toBeInTheDocument();
  });

  it("Choice → Manual fires onManualSelected", () => {
    const { onManualSelected } = renderModal();
    click("ai-modal-choice-manual");
    expect(onManualSelected).toHaveBeenCalledOnce();
  });

  it("Choice → AI advances to the Instructions scene", () => {
    renderModal();
    click("ai-modal-choice-ai");
    expect(screen.getByTestId("ai-modal-instructions")).toBeInTheDocument();
  });

  it("Cancel from Instructions emits onCancelFromAi with staged photos as ImageFile[]", async () => {
    const { onCancelFromAi } = renderModal();

    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg"), fakeFile("b.jpg")]);
    click("ai-modal-cancel");

    expect(onCancelFromAi).toHaveBeenCalledOnce();
    const images = onCancelFromAi.mock.calls[0][0];
    expect(images).toHaveLength(2);
    expect(images.map((i: { file: File }) => i.file.name)).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
  });

  it("Generate kicks off analyze, success → evidence callouts → onGenerated", async () => {
    const { onGenerated } = renderModal();

    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");

    expect(screen.getByTestId("ai-modal-processing")).toBeInTheDocument();
    expect(captured.generate).toHaveBeenCalledOnce();

    // Simulate analyze succeeding while ticker is mid-flight.
    act(() => {
      captured.last?.onSuccess(SAMPLE_DRAFT);
    });

    // Ticker finalize → 400ms grace.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // Evidence callouts visible during the post-finalize hold.
    expect(
      screen.getByTestId("ai-modal-evidence-callouts"),
    ).toBeInTheDocument();

    // Advance evidence display window → onGenerated fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onGenerated).toHaveBeenCalledOnce();
    expect(onGenerated.mock.calls[0][0]).toEqual(SAMPLE_DRAFT);
    const images = onGenerated.mock.calls[0][1];
    expect(images).toHaveLength(1);
    expect(images[0].file.name).toBe("a.jpg");
  });

  it("Generate → failure → ErrorView with the right reason", async () => {
    renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");

    act(() => {
      captured.last?.onFailure("network");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByTestId("ai-modal-error")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-error-retry")).toBeInTheDocument();
  });

  it("Error → Continue Manually fires onCancelFromAi preserving photos (Req 9.5)", async () => {
    const { onCancelFromAi } = renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    act(() => {
      captured.last?.onFailure("rate_limited");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    click("ai-modal-error-continue-manually");

    expect(onCancelFromAi).toHaveBeenCalledOnce();
    expect(onCancelFromAi.mock.calls[0][0]).toHaveLength(1);
  });

  it("Error → Try Again re-enters Processing and re-invokes generate", async () => {
    renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    expect(captured.generate).toHaveBeenCalledTimes(1);

    act(() => {
      captured.last?.onFailure("network");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByTestId("ai-modal-error")).toBeInTheDocument();

    click("ai-modal-error-retry");

    expect(screen.getByTestId("ai-modal-processing")).toBeInTheDocument();
    expect(captured.generate).toHaveBeenCalledTimes(2);
  });

  it("Error → Add More Photos returns to Instructions with photos preserved", async () => {
    renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");
    act(() => {
      captured.last?.onFailure("low_confidence");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    click("ai-modal-error-add-photos");

    expect(screen.getByTestId("ai-modal-instructions")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-staged-photos")).toBeInTheDocument();
  });

  it("converts HEIC uploads through processSelectedFiles before staging (Req 2.3)", async () => {
    const { onCancelFromAi } = renderModal();
    // Simulate the helper performing HEIC → JPEG conversion: it receives a
    // HEIC file and returns a JPEG one.
    processSelectedFilesMock.mockImplementationOnce(async (files) => {
      const arr = Array.from(files as File[]);
      const converted = arr.map(
        (f) =>
          new File([new Uint8Array([1])], f.name.replace(/\.heic$/i, ".jpg"), {
            type: "image/jpeg",
          }),
      );
      return { files: converted, errors: [], heicConversionCount: arr.length };
    });

    const heic = new File([new Uint8Array([1])], "IMG_0347.HEIC", {
      type: "image/heic",
    });

    click("ai-modal-choice-ai");
    await uploadFiles([heic]);

    expect(processSelectedFilesMock).toHaveBeenCalledOnce();
    expect(processSelectedFilesMock.mock.calls[0][0]).toEqual([heic]);

    click("ai-modal-cancel");

    const images = onCancelFromAi.mock.calls[0][0];
    expect(images).toHaveLength(1);
    expect(images[0].file.name).toBe("IMG_0347.jpg");
    expect(images[0].file.type).toBe("image/jpeg");
  });

  it("surfaces processor errors as toasts and does not stage rejected files", async () => {
    const { toast } = await import("sonner");
    const errorSpy = vi.spyOn(toast, "error");
    processSelectedFilesMock.mockImplementationOnce(async () => ({
      files: [],
      errors: [
        {
          fileName: "huge.jpg",
          reason: "too-large",
          message: "huge.jpg is 12.0MB. Maximum is 10MB.",
          fileSize: 12 * 1024 * 1024,
        },
      ],
      heicConversionCount: 0,
    }));

    renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("huge.jpg")]);

    expect(errorSpy).toHaveBeenCalledWith(
      "huge.jpg is 12.0MB. Maximum is 10MB.",
    );
    expect(
      screen.queryByTestId("ai-modal-staged-photos"),
    ).not.toBeInTheDocument();
  });

  it("disables Generate and the file inputs while files are being processed", async () => {
    let resolveProcess:
      | ((value: {
          files: File[];
          errors: never[];
          heicConversionCount: number;
        }) => void)
      | null = null;
    processSelectedFilesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProcess = resolve;
        }),
    );

    renderModal();
    click("ai-modal-choice-ai");
    // Don't await — kick off the change and let it stall on the pending promise.
    const input = screen.getByTestId("ai-modal-file-input") as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [fakeFile("a.jpg")],
      configurable: true,
    });
    await act(async () => {
      fireEvent.change(input);
    });

    expect(screen.getByTestId("ai-modal-processing-files")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-add-photos")).toBeDisabled();
    expect(screen.getByTestId("ai-modal-take-photo")).toBeDisabled();

    await act(async () => {
      resolveProcess?.({
        files: [fakeFile("a.jpg")],
        errors: [],
        heicConversionCount: 0,
      });
    });

    expect(
      screen.queryByTestId("ai-modal-processing-files"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-add-photos")).not.toBeDisabled();
  });

  it("revokes object URLs when a staged photo is removed (no memory leak)", async () => {
    renderModal();
    const revokeSpy = URL.revokeObjectURL as unknown as Mock;

    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);

    const removeBtn = screen
      .getByTestId("ai-modal-staged-photos")
      .querySelector(
        '[data-testid^="ai-modal-remove-photo-"]',
      ) as HTMLButtonElement;
    fireEvent.click(removeBtn);

    expect(revokeSpy).toHaveBeenCalled();
  });

  it("walks the ticker through every step when generation outlives the script", async () => {
    renderModal();
    click("ai-modal-choice-ai");
    await uploadFiles([fakeFile("a.jpg")]);
    click("ai-modal-generate");

    // Walk one step at a time — React 19 + vitest fake timers can't sweep
    // multi-tick effect chains in one call.
    for (const step of PROCESSING_STEPS) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(step.minMs);
      });
    }

    const lastStep = PROCESSING_STEPS[PROCESSING_STEPS.length - 1];
    expect(screen.getByTestId(`ai-modal-step-${lastStep.id}`)).toHaveAttribute(
      "data-status",
      "active",
    );
  });
});

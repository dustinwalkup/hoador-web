import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type StagedPhoto } from "@/features/listings/ai-listing-assistant/types";

import { InstructionsView } from "../instructions-view";

function photo(id: string): StagedPhoto {
  return {
    id,
    file: new File([new Uint8Array([1])], `${id}.jpg`, {
      type: "image/jpeg",
    }),
    previewUrl: `blob:preview-${id}`,
    dataUrl: `data:image/jpeg;base64,${id}`,
  };
}

function renderView(
  overrides: Partial<React.ComponentProps<typeof InstructionsView>> = {},
) {
  const props = {
    staged: [],
    onAddFiles: vi.fn(),
    onRemovePhoto: vi.fn(),
    onGenerate: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const utils = render(<InstructionsView {...props} />);
  return { ...utils, ...props };
}

describe("InstructionsView", () => {
  it("renders guidance for all four photo types with the 'why' framing (Req 3.2)", () => {
    renderView();

    const titles = [
      "Full tool photo",
      "Brand/model label close-up",
      "Accessories included",
      "Condition close-up",
    ];
    for (const t of titles) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }

    // At least one entry includes the "why" framing for AI identification.
    expect(
      screen.getByText(/helps us identify the exact tool/i),
    ).toBeInTheDocument();
  });

  it("recommends 3–5 photos (Req 3.2)", () => {
    renderView();
    expect(screen.getByText(/3–5 photos/i)).toBeInTheDocument();
  });

  it("disables Generate when no photos are staged (Req 3.7)", () => {
    renderView({ staged: [] });
    expect(screen.getByTestId("ai-modal-generate")).toBeDisabled();
  });

  it("enables Generate when at least one photo is staged", () => {
    renderView({ staged: [photo("a")] });
    expect(screen.getByTestId("ai-modal-generate")).not.toBeDisabled();
  });

  it("renders staged photo previews with remove controls", () => {
    renderView({ staged: [photo("a"), photo("b")] });

    const list = screen.getByTestId("ai-modal-staged-photos");
    expect(within(list).getAllByRole("img")).toHaveLength(2);
    expect(screen.getByTestId("ai-modal-remove-photo-a")).toBeInTheDocument();
    expect(screen.getByTestId("ai-modal-remove-photo-b")).toBeInTheDocument();
  });

  it("fires onRemovePhoto with the photo id when remove is clicked", async () => {
    const onRemovePhoto = vi.fn();
    renderView({ staged: [photo("a"), photo("b")], onRemovePhoto });

    await userEvent.click(screen.getByTestId("ai-modal-remove-photo-b"));
    expect(onRemovePhoto).toHaveBeenCalledWith("b");
  });

  it("fires onAddFiles with selected files via the file picker", async () => {
    const onAddFiles = vi.fn();
    renderView({ onAddFiles });

    const input = screen.getByTestId("ai-modal-file-input") as HTMLInputElement;
    await userEvent.upload(input, [
      new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array([2])], "b.jpg", { type: "image/jpeg" }),
    ]);

    expect(onAddFiles).toHaveBeenCalledOnce();
    const files = onAddFiles.mock.calls[0][0] as File[];
    expect(files.map((f) => f.name)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("camera input has the capture attribute set for mobile (Req 3.5)", () => {
    renderView();
    const input = screen.getByTestId(
      "ai-modal-camera-input",
    ) as HTMLInputElement;
    expect(input.getAttribute("capture")).toBe("environment");
    expect(input.getAttribute("accept")).toBe("image/*");
  });

  it("fires onGenerate when Generate Listing Draft is clicked", async () => {
    const onGenerate = vi.fn();
    renderView({ staged: [photo("a")], onGenerate });

    await userEvent.click(screen.getByTestId("ai-modal-generate"));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("fires onCancel when Cancel is clicked (Req 3.8)", async () => {
    const onCancel = vi.fn();
    renderView({ staged: [photo("a")], onCancel });

    await userEvent.click(screen.getByTestId("ai-modal-cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("file inputs accept image/* and allow multiple selections", () => {
    renderView();
    const input = screen.getByTestId("ai-modal-file-input") as HTMLInputElement;
    expect(input.accept).toBe("image/*");
    expect(input.multiple).toBe(true);
  });
});

import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AiDraft,
  type AiPrefilledFieldKey,
} from "@/features/listings/ai-listing-assistant/types";
import { type ImageFile } from "@/features/listings/form-schema/listing.schema";

import { CreateListingClient } from "../create-listing-client";

// We mock the two big children so we can introspect the prop flow without
// rendering the actual form (which needs RHF, RQ, etc.) or the actual modal
// (Radix Dialog, focus traps, simulated steps). The tests focus on what the
// orchestrator does with state, not on what the children render.
type ModalCaptured = {
  open: boolean;
  onManualSelected: () => void;
  onCancelFromAi: (images: ImageFile[]) => void;
  onGenerated: (draft: AiDraft, images: ImageFile[]) => void;
};
type FormCaptured = {
  mountId: number;
  initialValues?: Record<string, unknown>;
  aiPrefilledFields?: ReadonlyArray<AiPrefilledFieldKey>;
};

const captured: {
  modal: ModalCaptured | null;
  formRenders: FormCaptured[];
  totalMounts: number;
} = { modal: null, formRenders: [], totalMounts: 0 };

vi.mock(
  "@/features/listings/components/ai-listing-assistant/ai-listing-assistant-modal",
  () => ({
    AIListingAssistantModal: (props: ModalCaptured) => {
      captured.modal = props;
      return <div data-testid="mock-modal" data-open={String(props.open)} />;
    },
  }),
);

vi.mock("../add-listing-form", () => ({
  AddListingForm: (props: {
    initialValues?: Record<string, unknown>;
    aiPrefilledFields?: ReadonlyArray<AiPrefilledFieldKey>;
  }) => {
    // Mount-stable id: assigned once via useEffect on first render of each
    // component instance. Lets the test distinguish remounts (key bump) from
    // ordinary re-renders triggered by sibling state changes.
    const [mountId, setMountId] = useState<number | null>(null);
    useEffect(() => {
      captured.totalMounts += 1;
      setMountId(captured.totalMounts);
    }, []);
    captured.formRenders.push({
      mountId: mountId ?? -1,
      initialValues: props.initialValues,
      aiPrefilledFields: props.aiPrefilledFields,
    });
    return (
      <div data-testid="mock-form" data-mount-id={String(mountId ?? -1)} />
    );
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

function imageFile(id: string, name: string): ImageFile {
  return {
    id,
    file: new File([new Uint8Array([1])], name, { type: "image/jpeg" }),
    url: `blob:${name}`,
    orderIndex: 0,
    status: "ready",
  };
}

beforeEach(() => {
  captured.modal = null;
  captured.formRenders = [];
  captured.totalMounts = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CreateListingClient", () => {
  it("mounts the form empty and opens the modal in the Choice state on load (Req 1.1)", () => {
    render(<CreateListingClient categories={[]} />);

    expect(screen.getByTestId("mock-form")).toBeInTheDocument();
    expect(screen.getByTestId("mock-modal").dataset.open).toBe("true");

    // First mount: no AI prefill, no preserved images.
    const first = captured.formRenders[0];
    expect(first.initialValues).toBeUndefined();
    expect(first.aiPrefilledFields).toBeUndefined();
    expect(captured.totalMounts).toBe(1);
  });

  it("Manual → closes modal in place, leaves form untouched (Req 1.4)", () => {
    render(<CreateListingClient categories={[]} />);

    act(() => captured.modal?.onManualSelected());

    expect(screen.getByTestId("mock-modal").dataset.open).toBe("false");
    expect(
      captured.formRenders[captured.formRenders.length - 1].initialValues,
    ).toBeUndefined();
  });

  it("Manual dismissal is sticky — modal does not auto-reopen (Req 1.6)", () => {
    const { rerender } = render(<CreateListingClient categories={[]} />);
    act(() => captured.modal?.onManualSelected());
    // Force a parent re-render.
    rerender(<CreateListingClient categories={[]} />);
    expect(screen.getByTestId("mock-modal").dataset.open).toBe("false");
  });

  it("Generate success → form remounts with prefill + staged images", () => {
    render(<CreateListingClient categories={[]} />);
    const initialMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );

    const images = [imageFile("a", "a.jpg"), imageFile("b", "b.jpg")];
    act(() => captured.modal?.onGenerated(SAMPLE_DRAFT, images));

    const latestMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );
    expect(latestMountId).toBeGreaterThan(initialMountId);

    const last = captured.formRenders[captured.formRenders.length - 1];
    expect(last.initialValues?.name).toBe(SAMPLE_DRAFT.name);
    expect(last.initialValues?.categoryId).toBe(SAMPLE_DRAFT.categoryId);
    expect(last.initialValues?.condition).toBe(SAMPLE_DRAFT.condition);
    expect(last.initialValues?.images).toEqual(images);

    expect(last.aiPrefilledFields).toContain("name");
    expect(last.aiPrefilledFields).toContain("categoryId");
    expect(last.aiPrefilledFields).toContain("brand");
    expect(last.aiPrefilledFields).not.toContain("instructions");
    expect(last.aiPrefilledFields).not.toContain("safetyNotes");

    expect(screen.getByTestId("mock-modal").dataset.open).toBe("false");
  });

  it("Cancel from AI → form receives the staged photos but no AI prefill (Req 9.5)", () => {
    render(<CreateListingClient categories={[]} />);
    const initialMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );

    const images = [imageFile("a", "a.jpg"), imageFile("b", "b.jpg")];
    act(() => captured.modal?.onCancelFromAi(images));

    const latestMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );
    expect(latestMountId).toBeGreaterThan(initialMountId);

    const last = captured.formRenders[captured.formRenders.length - 1];
    expect(last.initialValues?.images).toEqual(images);
    expect(last.aiPrefilledFields).toBeUndefined();
    expect(last.initialValues?.name).toBeUndefined();
    expect(last.initialValues?.categoryId).toBeUndefined();

    expect(screen.getByTestId("mock-modal").dataset.open).toBe("false");
  });

  it("Cancel from AI with zero staged photos does not remount the form unnecessarily", () => {
    render(<CreateListingClient categories={[]} />);
    const initialMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );

    act(() => captured.modal?.onCancelFromAi([]));

    const latestMountId = Number(
      screen.getByTestId("mock-form").dataset.mountId,
    );
    expect(latestMountId).toBe(initialMountId);

    expect(screen.getByTestId("mock-modal").dataset.open).toBe("false");
  });
});

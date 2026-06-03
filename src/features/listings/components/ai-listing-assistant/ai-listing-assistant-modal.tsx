"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { emitAiEvent } from "@/features/listings/ai-listing-assistant/lib/telemetry";
import { useAnalyzeListingDraft } from "@/features/listings/hooks/use-analyze-listing-draft";
import {
  type AiDraft,
  type AiFailureReason,
  type ModalState,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";
import { type ImageFile } from "@/features/listings/form-schema/listing.schema";

import { ChoiceView } from "./choice-view";
import { ErrorView } from "./error-view";
import { InstructionsView } from "./instructions-view";
import { INITIAL_MODAL_STATE, modalReducer } from "./modal-state";
import { PROCESSING_STEPS, ProcessingView } from "./processing-view";
import { useSimulatedSteps } from "./use-simulated-steps";

/** Time we hold on the success callouts before dispatching the close. */
const EVIDENCE_DISPLAY_MS = 1500;

export interface AIListingAssistantModalProps {
  open: boolean;
  onManualSelected: () => void;
  onCancelFromAi: (images: ImageFile[]) => void;
  onGenerated: (draft: AiDraft, images: ImageFile[]) => void;
}

function fileToStagedPhoto(file: File): StagedPhoto {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    // dataUrl is computed lazily by `useAnalyzeListingDraft` from `file` on
    // Generate click (Req 4.6). Empty until then.
    dataUrl: "",
  };
}

function stagedToImageFiles(staged: StagedPhoto[]): ImageFile[] {
  return staged.map((p, idx) => ({
    id: p.id,
    file: p.file,
    url: p.previewUrl,
    orderIndex: idx,
    status: "ready" as const,
  }));
}

export function AIListingAssistantModal({
  open,
  onManualSelected,
  onCancelFromAi,
  onGenerated,
}: AIListingAssistantModalProps) {
  const [state, dispatch] = useReducer(modalReducer, INITIAL_MODAL_STATE);

  // Fire the modal-opened event once when the modal first becomes open.
  const openedFiredRef = useRef(false);
  useEffect(() => {
    if (!open || openedFiredRef.current) return;
    openedFiredRef.current = true;
    emitAiEvent("listing_create_modal_opened", {
      entryPath: "create_listing_page",
    });
  }, [open]);

  // Track pending generation results so we can defer the dispatch until after
  // the simulated step ticker has finished its 400 ms grace.
  const [pendingDraft, setPendingDraft] = useState<AiDraft | null>(null);
  const [pendingFailure, setPendingFailure] = useState<AiFailureReason | null>(
    null,
  );

  // Ref to short-circuit terminal-state firing in StrictMode/dev double-mount.
  const terminalFiredRef = useRef(false);

  const isProcessing = state.kind === "processing";
  const ticker = useSimulatedSteps(isProcessing, PROCESSING_STEPS);

  // Capture staged-photo count at generation time so success/failure events
  // can report it without re-reading state at the wrong moment.
  const photoCountAtGenerateRef = useRef(0);

  const analyze = useAnalyzeListingDraft({
    onSuccess: (draft) => {
      emitAiEvent("listing_ai_generation_succeeded", {
        photoCount: photoCountAtGenerateRef.current,
        prefilledFields: prefilledFieldList(draft),
        categoryResolved: draft.categoryId !== null,
        conditionResolved: draft.condition !== null,
      });
      setPendingDraft(draft);
      ticker.finalize();
    },
    onFailure: (reason) => {
      emitAiEvent("listing_ai_generation_failed", {
        photoCount: photoCountAtGenerateRef.current,
        reason,
      });
      setPendingFailure(reason);
      ticker.finalize();
    },
  });

  // Kick off the AI call exactly once per entry to the processing state.
  const lastProcessingStartRef = useRef(0);
  useEffect(() => {
    if (state.kind !== "processing") return;
    const epoch = lastProcessingStartRef.current + 1;
    lastProcessingStartRef.current = epoch;
    photoCountAtGenerateRef.current = state.staged.length;
    emitAiEvent("listing_ai_generation_started", {
      photoCount: state.staged.length,
    });
    setPendingDraft(null);
    setPendingFailure(null);
    void analyze.generate(state.staged.map((p) => p.file));
    // `analyze` and the staged list are stable for the duration of this entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  // Dispatch success/failure after the ticker grace has elapsed.
  useEffect(() => {
    if (!isProcessing) return;
    if (!ticker.isFinalized) return;
    if (pendingFailure) {
      dispatch({ type: "GENERATE_FAILURE", reason: pendingFailure });
      return;
    }
    if (pendingDraft) {
      const handle = setTimeout(() => {
        dispatch({ type: "GENERATE_SUCCESS", draft: pendingDraft });
      }, EVIDENCE_DISPLAY_MS);
      return () => clearTimeout(handle);
    }
  }, [isProcessing, ticker.isFinalized, pendingDraft, pendingFailure]);

  // Fire the matching parent callback when we land on a terminal state.
  useEffect(() => {
    if (terminalFiredRef.current) return;
    if (state.kind === "closed_manual") {
      terminalFiredRef.current = true;
      onManualSelected();
    } else if (state.kind === "closed_cancel") {
      terminalFiredRef.current = true;
      onCancelFromAi(stagedToImageFiles(state.staged));
    } else if (state.kind === "closed_success") {
      terminalFiredRef.current = true;
      onGenerated(state.draft, stagedToImageFiles(state.staged));
    }
  }, [state, onManualSelected, onCancelFromAi, onGenerated]);

  // Add files via composer — owns URL creation and dispatches STAGE_PHOTOS.
  const handleAddFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const photos = files.map(fileToStagedPhoto);
      dispatch({ type: "STAGE_PHOTOS", photos });
      if (state.kind === "instructions") {
        emitAiEvent("listing_ai_photos_staged", {
          count: state.staged.length + photos.length,
        });
      }
    },
    [state],
  );

  // Remove also handles URL cleanup so we don't leak the object URL.
  const handleRemovePhoto = useCallback(
    (id: string) => {
      if (state.kind !== "instructions") return;
      const removed = state.staged.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      dispatch({ type: "REMOVE_PHOTO", id });
      emitAiEvent("listing_ai_photos_staged", {
        count: state.staged.length - (removed ? 1 : 0),
      });
    },
    [state],
  );

  // Render the active scene. Terminal `closed_*` states render nothing —
  // the parent flips `open` to false on the matching callback.
  const view = renderScene(state, {
    onChooseAi: () => {
      emitAiEvent("listing_create_choice_selected", { choice: "ai" });
      dispatch({ type: "CHOOSE_AI" });
    },
    onChooseManual: () => {
      emitAiEvent("listing_create_choice_selected", { choice: "manual" });
      dispatch({ type: "CHOOSE_MANUAL" });
    },
    onAddFiles: handleAddFiles,
    onRemovePhoto: handleRemovePhoto,
    onGenerate: () => dispatch({ type: "BEGIN_GENERATE" }),
    onCancel: () => dispatch({ type: "CANCEL_AI" }),
    onTryAgain: () => dispatch({ type: "RETRY_FROM_ERROR" }),
    onAddMorePhotos: () => dispatch({ type: "BACK_TO_INSTRUCTIONS" }),
    onContinueManually: () => {
      // Only fires from `error` (per the modal-state machine). Emit a
      // distinct event so funnel analysis can separate "user gave up after
      // a failure" from "user cancelled mid-AI flow".
      if (state.kind === "error") {
        emitAiEvent("listing_ai_continue_manually_after_failure", {
          reason: state.reason,
        });
      }
      dispatch({ type: "CANCEL_AI" });
    },
    currentStepIndex: ticker.currentStepIndex,
    evidenceDraft: ticker.isFinalized ? pendingDraft : null,
  });

  // Prevent dismiss by escape or overlay click while a request is in flight
  // (design §5.5 — no accidental abandonment mid-call).
  const blockDismiss = isProcessing;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => blockDismiss && e.preventDefault()}
        onPointerDownOutside={(e) => blockDismiss && e.preventDefault()}
        onInteractOutside={(e) => blockDismiss && e.preventDefault()}
        data-testid="ai-listing-assistant-modal"
      >
        <DialogHeader>
          <DialogTitle>{titleFor(state.kind)}</DialogTitle>
          <DialogDescription className="sr-only">
            AI Listing Assistant
          </DialogDescription>
        </DialogHeader>
        {view}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Names of fields the AI confidently emitted on a draft — used as a
 * compact tag list in the `listing_ai_generation_succeeded` event payload.
 */
function prefilledFieldList(draft: AiDraft): string[] {
  const out: string[] = [];
  if (draft.name) out.push("name");
  if (draft.description) out.push("description");
  if (draft.categoryId) out.push("categoryId");
  if (draft.brand) out.push("brand");
  if (draft.model) out.push("model");
  if (draft.condition) out.push("condition");
  if (Object.keys(draft.specifications).length > 0) out.push("specifications");
  if (draft.instructions) out.push("instructions");
  if (draft.safetyNotes) out.push("safetyNotes");
  return out;
}

function titleFor(kind: ModalState["kind"]): string {
  switch (kind) {
    case "choice":
      return "Create your listing";
    case "instructions":
      return "Add photos of your item";
    case "processing":
      return "Drafting your listing";
    case "error":
      return "We hit a snag";
    case "closed_manual":
    case "closed_cancel":
    case "closed_success":
      return "";
  }
}

interface SceneHandlers {
  onChooseAi: () => void;
  onChooseManual: () => void;
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onTryAgain: () => void;
  onAddMorePhotos: () => void;
  onContinueManually: () => void;
  currentStepIndex: number;
  evidenceDraft: AiDraft | null;
}

function renderScene(state: ModalState, h: SceneHandlers) {
  switch (state.kind) {
    case "choice":
      return (
        <ChoiceView
          onChooseAi={h.onChooseAi}
          onChooseManual={h.onChooseManual}
        />
      );
    case "instructions":
      return (
        <InstructionsView
          staged={state.staged}
          onAddFiles={h.onAddFiles}
          onRemovePhoto={h.onRemovePhoto}
          onGenerate={h.onGenerate}
          onCancel={h.onCancel}
        />
      );
    case "processing":
      return (
        <ProcessingView
          currentStepIndex={h.currentStepIndex}
          evidenceDraft={h.evidenceDraft}
        />
      );
    case "error":
      return (
        <ErrorView
          reason={state.reason}
          onTryAgain={h.onTryAgain}
          onAddMorePhotos={h.onAddMorePhotos}
          onContinueManually={h.onContinueManually}
        />
      );
    case "closed_manual":
    case "closed_cancel":
    case "closed_success":
      return null;
  }
}

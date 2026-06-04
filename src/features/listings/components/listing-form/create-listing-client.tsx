"use client";

import { useCallback, useMemo, useState } from "react";

import {
  aiDraftToInitialValues,
  computeAiPrefilledFields,
} from "@/features/listings/ai-listing-assistant/ai-draft-to-initial-values";
import {
  type AiDraft,
  type AiPrefilledFieldKey,
} from "@/features/listings/ai-listing-assistant/types";
import { AIListingAssistantModal } from "@/features/listings/components/ai-listing-assistant/ai-listing-assistant-modal";
import {
  type CreateListingFormClientValues,
  type ImageFile,
} from "@/features/listings/form-schema/listing.schema";

import { AddListingForm } from "./add-listing-form";
import { type OwnerPolicyDocuments } from "./legal-document-acknowledgments";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface CreateListingClientProps {
  categories: Category[];
  ownerPolicyDocuments?: OwnerPolicyDocuments;
}

/**
 * Orchestrator for the create-listing page. Owns the AI Listing Assistant
 * modal alongside the standard listing form. The form mounts empty on page
 * load with the modal layered on top in its Choice state (Req 1.1).
 *
 * State:
 *   - `aiDraft`: stored on AI success so the next render of the form has
 *     `initialValues` and `aiPrefilledFields` set.
 *   - `stagedImages`: photos forwarded from the modal to the form, both on
 *     successful generation and on cancel-from-AI (Req 9.5 — photos preserved).
 *   - `formKey`: bumped whenever we need react-hook-form to reinitialize via
 *     remount (so AI prefill flows through `initialValues`).
 *   - `modalDismissed`: once the modal is dismissed in any session, we do not
 *     auto-reopen it (Req 1.6).
 */
export function CreateListingClient({
  categories,
  ownerPolicyDocuments,
}: CreateListingClientProps) {
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [stagedImages, setStagedImages] = useState<ImageFile[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [modalDismissed, setModalDismissed] = useState(false);

  const handleManualSelected = useCallback(() => {
    // Req 1.4: Manual dismisses the modal in place; nothing else changes.
    setModalDismissed(true);
  }, []);

  const handleCancelFromAi = useCallback((images: ImageFile[]) => {
    // Req 9.5: dismiss + preserve staged photos in the form (no AI prefill).
    setStagedImages(images);
    if (images.length > 0) setFormKey((k) => k + 1);
    setModalDismissed(true);
  }, []);

  const handleGenerated = useCallback((draft: AiDraft, images: ImageFile[]) => {
    setAiDraft(draft);
    setStagedImages(images);
    setFormKey((k) => k + 1);
    setModalDismissed(true);
  }, []);

  // `initialValues` is rebuilt whenever the AI draft or staged images change.
  // We pass it as a plain object — the form's `useListingForm` spreads it over
  // defaults, so undefined/missing keys keep the manual defaults.
  const initialValues = useMemo<
    Partial<CreateListingFormClientValues> | undefined
  >(() => {
    if (aiDraft) return aiDraftToInitialValues(aiDraft, stagedImages);
    if (stagedImages.length > 0) return { images: stagedImages };
    return undefined;
  }, [aiDraft, stagedImages]);

  const aiPrefilledFields = useMemo<
    ReadonlyArray<AiPrefilledFieldKey> | undefined
  >(() => {
    if (!aiDraft) return undefined;
    return Array.from(computeAiPrefilledFields(aiDraft));
  }, [aiDraft]);

  return (
    <>
      <AddListingForm
        key={formKey}
        categories={categories}
        initialValues={initialValues}
        ownerPolicyDocuments={ownerPolicyDocuments}
        aiPrefilledFields={aiPrefilledFields}
        aiDraft={aiDraft}
      />
      <AIListingAssistantModal
        open={!modalDismissed}
        onManualSelected={handleManualSelected}
        onCancelFromAi={handleCancelFromAi}
        onGenerated={handleGenerated}
      />
    </>
  );
}

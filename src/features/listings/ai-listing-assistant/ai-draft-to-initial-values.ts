import {
  type CreateListingFormClientValues,
  type ImageFile,
} from "@/features/listings/form-schema/listing.schema";

import { type AiDraft, type AiPrefilledFieldKey } from "./types";

/**
 * Convert an `AiDraft` into a `Partial<CreateListingFormClientValues>` suitable
 * for react-hook-form's `defaultValues`. Only fields the AI actually emitted
 * are included — null/empty fields are omitted so the form's defaults survive.
 *
 * `images` is always included (even an empty array passes through; the form's
 * min-1-image validator runs at submit, not on init).
 */
export function aiDraftToInitialValues(
  draft: AiDraft,
  images: ImageFile[],
): Partial<CreateListingFormClientValues> {
  return {
    ...(draft.name ? { name: draft.name } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    ...(draft.brand ? { brand: draft.brand } : {}),
    ...(draft.model ? { model: draft.model } : {}),
    ...(draft.condition ? { condition: draft.condition } : {}),
    ...(Object.keys(draft.specifications).length > 0
      ? { specifications: draft.specifications }
      : {}),
    ...(draft.instructions ? { instructions: draft.instructions } : {}),
    ...(draft.safetyNotes ? { safetyNotes: draft.safetyNotes } : {}),
    images,
  };
}

/**
 * Return the set of `AiPrefilledFieldKey`s the draft actually emitted —
 * keys whose value is non-null/non-empty. Drives the form's "AI Suggested"
 * indicators, the draft notice, and the Safety Notes disclaimer.
 */
export function computeAiPrefilledFields(
  draft: AiDraft,
): ReadonlySet<AiPrefilledFieldKey> {
  const keys = new Set<AiPrefilledFieldKey>();
  if (draft.name) keys.add("name");
  if (draft.description) keys.add("description");
  if (draft.categoryId) keys.add("categoryId");
  if (draft.brand) keys.add("brand");
  if (draft.model) keys.add("model");
  if (draft.condition) keys.add("condition");
  if (Object.keys(draft.specifications).length > 0) keys.add("specifications");
  if (draft.instructions) keys.add("instructions");
  if (draft.safetyNotes) keys.add("safetyNotes");
  return keys;
}

import {
  type AiDraft,
  type AiPrefilledFieldKey,
} from "@/features/listings/ai-listing-assistant/types";
import {
  type CreateListingFormDataClientType,
  type CreateListingFormDataServerType,
} from "@/features/listings/form-schema/listing.schema";

/**
 * Count how many AI-prefilled fields the user changed before submitting.
 *
 * Used to power the "average edits after generation" secondary metric
 * (Req 12.2). A field is considered "edited" when:
 *   - it was emitted by the AI (present in `aiDraft` with a non-null value
 *     OR specifications had at least one entry), AND
 *   - the final form value differs from that AI value.
 *
 * The comparison is shallow:
 *   - strings: strict equality (after trimming so trailing-whitespace edits
 *     don't inflate the count)
 *   - specifications: deep equality on the record
 *
 * Returns 0 when `aiDraft` is null (manual flow).
 */
export function countEditedAiFields(
  aiDraft: AiDraft | null,
  finalValues:
    | CreateListingFormDataClientType
    | CreateListingFormDataServerType,
): number {
  if (!aiDraft) return 0;

  let edited = 0;
  const compareText = (
    key: AiPrefilledFieldKey,
    aiValue: string | null,
    finalValue: string | null | undefined,
  ): void => {
    if (!aiValue) return; // not prefilled
    if (normalizeText(finalValue) !== normalizeText(aiValue)) {
      edited++;
    }
    void key; // for symmetry / future per-key counting
  };

  compareText("name", aiDraft.name, finalValues.name);
  compareText("description", aiDraft.description, finalValues.description);
  compareText("brand", aiDraft.brand, finalValues.brand ?? null);
  compareText("model", aiDraft.model, finalValues.model ?? null);
  compareText(
    "instructions",
    aiDraft.instructions,
    finalValues.instructions ?? null,
  );
  compareText(
    "safetyNotes",
    aiDraft.safetyNotes,
    finalValues.safetyNotes ?? null,
  );

  if (aiDraft.categoryId && finalValues.categoryId !== aiDraft.categoryId) {
    edited++;
  }
  if (aiDraft.condition && finalValues.condition !== aiDraft.condition) {
    edited++;
  }

  if (Object.keys(aiDraft.specifications).length > 0) {
    if (
      !specificationsEqual(
        aiDraft.specifications,
        finalValues.specifications ?? {},
      )
    ) {
      edited++;
    }
  }

  return edited;
}

function normalizeText(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function specificationsEqual(
  a: Record<string, string>,
  b: Record<string, unknown>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== String(b[k] ?? "")) return false;
  }
  return true;
}

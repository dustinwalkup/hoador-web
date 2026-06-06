import { z } from "zod";

import { listingConditionSchema } from "@/features/listings/form-schema/listing.schema";

/**
 * Canonical condition values accepted by the listing form. Re-exported from
 * `listingConditionSchema` so the AI prompt, server coercion, and form
 * validation share one source of truth.
 */
export const CANONICAL_CONDITION_ENUM = listingConditionSchema.options;
export type CanonicalCondition = (typeof CANONICAL_CONDITION_ENUM)[number];

/**
 * Hard cap on photos staged in the AI Listing Assistant modal. The modal copy
 * recommends 3–5; this constant is the enforced ceiling shared by the reducer,
 * the composer's batch-trim, and the view's disabled-button state. Distinct
 * from the form's `MAX_IMAGES = 10` — the AI flow has a tighter cap because
 * each photo is sent to gpt-4o as a base64 data URL and counts against vision
 * token budget. Users can add more photos in the form after generation.
 */
export const MAX_AI_PHOTOS = 5;

/**
 * Form field keys that may be prefilled by AI generation. Used to drive the
 * "AI Suggested" indicators, the draft notice, and the Safety Notes disclaimer.
 */
export type AiPrefilledFieldKey =
  | "name"
  | "description"
  | "categoryId"
  | "brand"
  | "model"
  | "condition"
  | "specifications"
  | "instructions"
  | "safetyNotes";

/**
 * Canonical AI draft contract between the analyze route and the form.
 *
 * - `categoryId` is the resolved UUID (null when no confident match)
 * - `condition` is the canonical form enum (null when AI emitted anything else)
 * - Fields the AI could not confidently produce are `null`/empty per Req 5.6
 */
export interface AiDraft {
  name: string | null;
  description: string | null;
  categoryId: string | null;
  brand: string | null;
  model: string | null;
  condition: CanonicalCondition | null;
  specifications: Record<string, string>;
  instructions: string | null;
  safetyNotes: string | null;
}

/**
 * Raw AI response shape (server-side, private to the analyze route before
 * `resolveAiDraft` translates it into an `AiDraft`).
 */
export interface RawAiResponse {
  name: string;
  description: string;
  categoryName: string;
  brand: string | null;
  model: string | null;
  condition: string;
  // Values may be `null` because the prompt asks the model to omit individual
  // spec fields it can't determine. `dropEmptyValues` filters non-strings out.
  specifications: Record<string, string | null>;
  instructions: string;
  safetyNotes: string;
}

/**
 * Zod schema for `RawAiResponse`. Permissive on nullability so a model that
 * omits a field (or returns `null`) is parseable; coercion to the canonical
 * `AiDraft` happens in `resolveAiDraft`.
 */
export const rawAiResponseSchema: z.ZodType<RawAiResponse> = z.object({
  name: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  categoryName: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  brand: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  model: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  condition: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  specifications: z
    .record(z.string(), z.string().nullable())
    .nullish()
    .transform((v) => v ?? {}),
  instructions: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  safetyNotes: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
});

/**
 * Reasons the modal may surface a user-facing failure. Each maps to specific
 * UI copy and recovery actions (see `error-view.tsx`, Phase 5).
 */
export type AiFailureReason =
  | "low_confidence"
  | "unsuitable_content"
  | "network"
  | "rate_limited"
  | "server";

/**
 * A photo staged client-side in the AI modal before the user clicks
 * "Generate Listing Draft". Photos are never uploaded to blob storage from
 * the modal; only the staged data URLs are transmitted (Req 4.6).
 */
export interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  dataUrl: string;
}

/**
 * AI Listing Assistant modal state machine.
 *
 * Visible scenes:
 *   - `choice`        — landing buttons (AI vs Manual)
 *   - `instructions`  — photo guidance + staging + Generate trigger
 *   - `processing`    — AI call in flight; step ticker runs in `useSimulatedSteps`
 *   - `error`         — recoverable failure with retry/back/cancel actions
 *
 * Terminal scenes (the modal observer fires the matching parent callback and
 * the orchestrator flips `open` to false). The three flavors encode what the
 * parent needs to do next:
 *   - `closed_manual`  — user picked Manual; nothing to carry forward
 *   - `closed_cancel`  — user cancelled mid-AI-flow; carry staged photos
 *                        forward to the manual form (Req 9.5)
 *   - `closed_success` — AI returned a usable draft; prefill the form
 */
export type ModalState =
  | { kind: "choice" }
  | { kind: "instructions"; staged: StagedPhoto[] }
  | { kind: "processing"; staged: StagedPhoto[] }
  | { kind: "error"; reason: AiFailureReason; staged: StagedPhoto[] }
  | { kind: "closed_manual" }
  | { kind: "closed_cancel"; staged: StagedPhoto[] }
  | { kind: "closed_success"; draft: AiDraft; staged: StagedPhoto[] };

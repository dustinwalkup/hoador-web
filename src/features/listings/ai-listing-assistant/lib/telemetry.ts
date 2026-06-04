import { type AiFailureReason } from "@/features/listings/ai-listing-assistant/types";

/**
 * Client-side AI Listing Assistant telemetry events.
 *
 * The project's existing structured logger (`@/lib/logger`) is server-only —
 * it depends on `node:async_hooks`. There is no client-side analytics SDK
 * wired up today, so this helper is intentionally a thin shim: it produces
 * structured payloads on `console.info` (visible in DevTools, captured by
 * Sentry's console integration in production), tagged so a real analytics
 * pipeline (PostHog / Segment / etc.) can swap in by editing one function.
 *
 * Event names follow the design's `2-design.md` §Telemetry list.
 */
export type AiTelemetryEventName =
  | "listing_create_modal_opened"
  | "listing_create_choice_selected"
  | "listing_ai_photos_staged"
  | "listing_ai_generation_started"
  | "listing_ai_generation_succeeded"
  | "listing_ai_generation_failed"
  | "listing_ai_continue_manually_after_failure"
  | "listing_submitted";

interface BaseProps {
  [key: string]: unknown;
}

export interface ModalOpenedProps extends BaseProps {
  entryPath: "create_listing_page";
}

export interface ChoiceSelectedProps extends BaseProps {
  choice: "ai" | "manual";
}

export interface PhotosStagedProps extends BaseProps {
  count: number;
}

export interface GenerationStartedProps extends BaseProps {
  photoCount: number;
}

export interface GenerationSucceededProps extends BaseProps {
  photoCount: number;
  prefilledFields: string[];
  categoryResolved: boolean;
  conditionResolved: boolean;
}

export interface GenerationFailedProps extends BaseProps {
  photoCount: number;
  reason: AiFailureReason;
}

export interface ContinueManuallyAfterFailureProps extends BaseProps {
  reason: AiFailureReason;
}

export interface ListingSubmittedProps extends BaseProps {
  usedAi: boolean;
  prefilledFieldsCount: number;
  editedAiFieldsCount: number;
}

/**
 * Emit a structured telemetry event. Safe to call from any client component.
 * No-ops in test environments so test output stays clean.
 */
export function emitAiEvent(
  event: AiTelemetryEventName,
  props: BaseProps = {},
): void {
  if (process.env.NODE_ENV === "test") return;

  const payload = { event, ...props, ts: Date.now() };
  // Production analytics pipeline goes here. console.info gives a uniform
  // shape today; replace with `posthog.capture` / `analytics.track` / etc.
  // when one is adopted.
  console.info(payload);
}

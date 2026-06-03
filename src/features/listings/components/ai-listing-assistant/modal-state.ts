import {
  type AiDraft,
  type AiFailureReason,
  type ModalState,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";

/**
 * Pure state machine for the AI Listing Assistant modal.
 *
 * Invalid transitions (e.g. `BEGIN_GENERATE` from `choice`) are no-ops —
 * the reducer returns the unchanged state rather than throwing. This keeps
 * the UI safe from race-driven double-dispatches.
 *
 * Reference: `2-design.md` §Architecture state diagram.
 */
export type ModalAction =
  | { type: "CHOOSE_AI" }
  | { type: "CHOOSE_MANUAL" }
  | { type: "STAGE_PHOTOS"; photos: StagedPhoto[] }
  | { type: "REMOVE_PHOTO"; id: string }
  | { type: "CANCEL_AI" }
  | { type: "BEGIN_GENERATE" }
  | { type: "GENERATE_SUCCESS"; draft: AiDraft }
  | { type: "GENERATE_FAILURE"; reason: AiFailureReason }
  | { type: "RETRY_FROM_ERROR" }
  | { type: "BACK_TO_INSTRUCTIONS" };

export const INITIAL_MODAL_STATE: ModalState = { kind: "choice" };

export function modalReducer(
  state: ModalState,
  action: ModalAction,
): ModalState {
  switch (action.type) {
    case "CHOOSE_AI":
      if (state.kind === "choice") {
        return { kind: "instructions", staged: [] };
      }
      return state;

    case "CHOOSE_MANUAL":
      if (state.kind === "choice") {
        return { kind: "closed_manual" };
      }
      return state;

    case "STAGE_PHOTOS":
      if (state.kind === "instructions") {
        const nextStaged = dedupeAppend(state.staged, action.photos);
        return nextStaged === state.staged
          ? state
          : { kind: "instructions", staged: nextStaged };
      }
      return state;

    case "REMOVE_PHOTO":
      if (state.kind === "instructions") {
        const nextStaged = state.staged.filter((p) => p.id !== action.id);
        return nextStaged.length === state.staged.length
          ? state
          : { kind: "instructions", staged: nextStaged };
      }
      return state;

    case "CANCEL_AI":
      // "Cancel" exits the modal with staged photos preserved so the manual
      // form can pick them up (Req 9.5). Also available from `error` as the
      // "Continue manually" action.
      if (state.kind === "instructions" || state.kind === "error") {
        return { kind: "closed_cancel", staged: state.staged };
      }
      return state;

    case "BEGIN_GENERATE":
      // UI also disables this when staged is empty (Req 3.7); reducer enforces
      // it as belt-and-braces.
      if (state.kind === "instructions" && state.staged.length > 0) {
        return { kind: "processing", staged: state.staged };
      }
      return state;

    case "GENERATE_SUCCESS":
      if (state.kind === "processing") {
        return {
          kind: "closed_success",
          draft: action.draft,
          staged: state.staged,
        };
      }
      return state;

    case "GENERATE_FAILURE":
      if (state.kind === "processing") {
        return {
          kind: "error",
          reason: action.reason,
          staged: state.staged,
        };
      }
      return state;

    case "RETRY_FROM_ERROR":
      if (state.kind === "error") {
        return { kind: "processing", staged: state.staged };
      }
      return state;

    case "BACK_TO_INSTRUCTIONS":
      if (state.kind === "error") {
        return { kind: "instructions", staged: state.staged };
      }
      return state;

    default:
      return assertExhaustive(action);
  }
}

function dedupeAppend(
  existing: StagedPhoto[],
  incoming: StagedPhoto[],
): StagedPhoto[] {
  if (incoming.length === 0) return existing;
  const existingIds = new Set(existing.map((p) => p.id));
  const additions = incoming.filter((p) => !existingIds.has(p.id));
  return additions.length === 0 ? existing : [...existing, ...additions];
}

function assertExhaustive(action: never): never {
  throw new Error(`Non-exhaustive modal action: ${JSON.stringify(action)}`);
}

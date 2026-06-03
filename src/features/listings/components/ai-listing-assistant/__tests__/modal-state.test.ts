import { describe, expect, it } from "vitest";

import {
  type AiDraft,
  type ModalState,
  type StagedPhoto,
} from "@/features/listings/ai-listing-assistant/types";

import {
  INITIAL_MODAL_STATE,
  type ModalAction,
  modalReducer,
} from "../modal-state";

function photo(id: string): StagedPhoto {
  return {
    id,
    file: new File([], `${id}.jpg`, { type: "image/jpeg" }),
    previewUrl: `blob:${id}`,
    dataUrl: `data:image/jpeg;base64,${id}`,
  };
}

const SAMPLE_DRAFT: AiDraft = {
  name: "DeWalt 20V Cordless Drill",
  description: "A solid cordless drill.",
  categoryId: "uuid-power-tools",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "good",
  specifications: { power: "20V MAX" },
  instructions: null,
  safetyNotes: null,
};

describe("modalReducer", () => {
  describe("initial state", () => {
    it("starts in the choice scene", () => {
      expect(INITIAL_MODAL_STATE).toEqual({ kind: "choice" });
    });
  });

  describe("CHOOSE_AI", () => {
    it("from choice → instructions with empty staged", () => {
      const next = modalReducer(INITIAL_MODAL_STATE, { type: "CHOOSE_AI" });
      expect(next).toEqual({ kind: "instructions", staged: [] });
    });

    it("is a no-op from any non-choice state", () => {
      const states: ModalState[] = [
        { kind: "instructions", staged: [] },
        { kind: "processing", staged: [] },
        { kind: "error", reason: "network", staged: [] },
        { kind: "closed_manual" },
      ];
      for (const s of states) {
        expect(modalReducer(s, { type: "CHOOSE_AI" })).toBe(s);
      }
    });
  });

  describe("CHOOSE_MANUAL", () => {
    it("from choice → closed_manual (orchestrator closes the modal)", () => {
      expect(
        modalReducer(INITIAL_MODAL_STATE, { type: "CHOOSE_MANUAL" }),
      ).toEqual({ kind: "closed_manual" });
    });

    it("is a no-op from any non-choice state", () => {
      const s: ModalState = { kind: "instructions", staged: [photo("a")] };
      expect(modalReducer(s, { type: "CHOOSE_MANUAL" })).toBe(s);
    });
  });

  describe("STAGE_PHOTOS", () => {
    it("appends new photos to instructions staged list", () => {
      const a = photo("a");
      const b = photo("b");
      const c = photo("c");
      const start: ModalState = { kind: "instructions", staged: [a] };
      const next = modalReducer(start, {
        type: "STAGE_PHOTOS",
        photos: [b, c],
      });
      expect(next).toEqual({
        kind: "instructions",
        staged: [a, b, c],
      });
    });

    it("dedupes by id so the same photo can't be staged twice", () => {
      const a = photo("a");
      const start: ModalState = { kind: "instructions", staged: [a] };
      const next = modalReducer(start, {
        type: "STAGE_PHOTOS",
        photos: [a, photo("b")],
      });
      expect(
        (next as { staged: StagedPhoto[] }).staged.map((p) => p.id),
      ).toEqual(["a", "b"]);
    });

    it("returns same reference when staging an empty list (no churn)", () => {
      const start: ModalState = {
        kind: "instructions",
        staged: [photo("a")],
      };
      expect(modalReducer(start, { type: "STAGE_PHOTOS", photos: [] })).toBe(
        start,
      );
    });

    it("is a no-op from any non-instructions state", () => {
      const s: ModalState = { kind: "processing", staged: [photo("a")] };
      expect(
        modalReducer(s, { type: "STAGE_PHOTOS", photos: [photo("b")] }),
      ).toBe(s);
    });
  });

  describe("REMOVE_PHOTO", () => {
    it("removes the matching photo from instructions staged list", () => {
      const start: ModalState = {
        kind: "instructions",
        staged: [photo("a"), photo("b"), photo("c")],
      };
      const next = modalReducer(start, { type: "REMOVE_PHOTO", id: "b" });
      expect(
        (next as { staged: StagedPhoto[] }).staged.map((p) => p.id),
      ).toEqual(["a", "c"]);
    });

    it("is a no-op when the id is not staged", () => {
      const a = photo("a");
      const start: ModalState = { kind: "instructions", staged: [a] };
      const next = modalReducer(start, { type: "REMOVE_PHOTO", id: "zzz" });
      expect((next as { staged: StagedPhoto[] }).staged).toEqual([a]);
    });

    it("is a no-op from any non-instructions state", () => {
      const s: ModalState = { kind: "error", reason: "server", staged: [] };
      expect(modalReducer(s, { type: "REMOVE_PHOTO", id: "a" })).toBe(s);
    });
  });

  describe("CANCEL_AI", () => {
    it("from instructions → closed_cancel carrying staged photos (Req 9.5)", () => {
      const staged = [photo("a"), photo("b")];
      const start: ModalState = { kind: "instructions", staged };
      expect(modalReducer(start, { type: "CANCEL_AI" })).toEqual({
        kind: "closed_cancel",
        staged,
      });
    });

    it("from error → closed_cancel carrying staged photos (Continue manually)", () => {
      const staged = [photo("a")];
      const start: ModalState = {
        kind: "error",
        reason: "low_confidence",
        staged,
      };
      expect(modalReducer(start, { type: "CANCEL_AI" })).toEqual({
        kind: "closed_cancel",
        staged,
      });
    });

    it("is a no-op from processing (modal is non-dismissible mid-call)", () => {
      const s: ModalState = { kind: "processing", staged: [photo("a")] };
      expect(modalReducer(s, { type: "CANCEL_AI" })).toBe(s);
    });

    it("is a no-op from choice", () => {
      expect(modalReducer(INITIAL_MODAL_STATE, { type: "CANCEL_AI" })).toBe(
        INITIAL_MODAL_STATE,
      );
    });
  });

  describe("BEGIN_GENERATE", () => {
    it("from instructions with ≥1 photo → processing carrying staged", () => {
      const staged = [photo("a")];
      const start: ModalState = { kind: "instructions", staged };
      expect(modalReducer(start, { type: "BEGIN_GENERATE" })).toEqual({
        kind: "processing",
        staged,
      });
    });

    it("is a no-op from instructions when no photos are staged (Req 3.7 belt-and-braces)", () => {
      const start: ModalState = { kind: "instructions", staged: [] };
      expect(modalReducer(start, { type: "BEGIN_GENERATE" })).toBe(start);
    });

    it("is a no-op from choice (cannot generate without selecting AI first)", () => {
      expect(
        modalReducer(INITIAL_MODAL_STATE, { type: "BEGIN_GENERATE" }),
      ).toBe(INITIAL_MODAL_STATE);
    });

    it("is a no-op from processing (prevents double-fire)", () => {
      const s: ModalState = { kind: "processing", staged: [photo("a")] };
      expect(modalReducer(s, { type: "BEGIN_GENERATE" })).toBe(s);
    });
  });

  describe("GENERATE_SUCCESS", () => {
    it("from processing → closed_success carrying draft and staged", () => {
      const staged = [photo("a"), photo("b")];
      const start: ModalState = { kind: "processing", staged };
      expect(
        modalReducer(start, { type: "GENERATE_SUCCESS", draft: SAMPLE_DRAFT }),
      ).toEqual({
        kind: "closed_success",
        draft: SAMPLE_DRAFT,
        staged,
      });
    });

    it("is a no-op from non-processing states", () => {
      const states: ModalState[] = [
        { kind: "choice" },
        { kind: "instructions", staged: [] },
        { kind: "error", reason: "server", staged: [] },
      ];
      for (const s of states) {
        expect(
          modalReducer(s, { type: "GENERATE_SUCCESS", draft: SAMPLE_DRAFT }),
        ).toBe(s);
      }
    });
  });

  describe("GENERATE_FAILURE", () => {
    it("from processing → error carrying reason and staged", () => {
      const staged = [photo("a")];
      const start: ModalState = { kind: "processing", staged };
      expect(
        modalReducer(start, {
          type: "GENERATE_FAILURE",
          reason: "rate_limited",
        }),
      ).toEqual({
        kind: "error",
        reason: "rate_limited",
        staged,
      });
    });

    it("is a no-op from non-processing states", () => {
      expect(
        modalReducer(INITIAL_MODAL_STATE, {
          type: "GENERATE_FAILURE",
          reason: "network",
        }),
      ).toBe(INITIAL_MODAL_STATE);
    });
  });

  describe("RETRY_FROM_ERROR", () => {
    it("from error → processing carrying staged", () => {
      const staged = [photo("a")];
      const start: ModalState = { kind: "error", reason: "network", staged };
      expect(modalReducer(start, { type: "RETRY_FROM_ERROR" })).toEqual({
        kind: "processing",
        staged,
      });
    });

    it("is a no-op from non-error states", () => {
      const s: ModalState = { kind: "instructions", staged: [photo("a")] };
      expect(modalReducer(s, { type: "RETRY_FROM_ERROR" })).toBe(s);
    });
  });

  describe("BACK_TO_INSTRUCTIONS", () => {
    it("from error → instructions carrying staged (Add more photos)", () => {
      const staged = [photo("a")];
      const start: ModalState = {
        kind: "error",
        reason: "low_confidence",
        staged,
      };
      expect(modalReducer(start, { type: "BACK_TO_INSTRUCTIONS" })).toEqual({
        kind: "instructions",
        staged,
      });
    });

    it("is a no-op from non-error states", () => {
      expect(
        modalReducer(INITIAL_MODAL_STATE, { type: "BACK_TO_INSTRUCTIONS" }),
      ).toBe(INITIAL_MODAL_STATE);
    });
  });

  describe("terminal states are inert", () => {
    const terminalStates: ModalState[] = [
      { kind: "closed_manual" },
      { kind: "closed_cancel", staged: [] },
      { kind: "closed_success", draft: SAMPLE_DRAFT, staged: [] },
    ];
    it.each(terminalStates)("ignores every action when in $kind", (state) => {
      const actions: ModalAction[] = [
        { type: "CHOOSE_AI" },
        { type: "CHOOSE_MANUAL" },
        { type: "STAGE_PHOTOS", photos: [photo("x")] },
        { type: "REMOVE_PHOTO", id: "x" },
        { type: "CANCEL_AI" },
        { type: "BEGIN_GENERATE" },
        { type: "GENERATE_SUCCESS", draft: SAMPLE_DRAFT },
        { type: "GENERATE_FAILURE", reason: "server" },
        { type: "RETRY_FROM_ERROR" },
        { type: "BACK_TO_INSTRUCTIONS" },
      ];
      for (const a of actions) {
        expect(modalReducer(state, a)).toBe(state);
      }
    });
  });

  describe("full happy-path walkthrough", () => {
    it("choice → instructions → stage → generate → success", () => {
      const photos = [photo("a"), photo("b"), photo("c")];

      let state: ModalState = INITIAL_MODAL_STATE;
      state = modalReducer(state, { type: "CHOOSE_AI" });
      expect(state.kind).toBe("instructions");

      state = modalReducer(state, { type: "STAGE_PHOTOS", photos });
      expect((state as { staged: StagedPhoto[] }).staged).toHaveLength(3);

      state = modalReducer(state, { type: "BEGIN_GENERATE" });
      expect(state.kind).toBe("processing");

      state = modalReducer(state, {
        type: "GENERATE_SUCCESS",
        draft: SAMPLE_DRAFT,
      });
      expect(state).toEqual({
        kind: "closed_success",
        draft: SAMPLE_DRAFT,
        staged: photos,
      });
    });

    it("full error → retry → success walkthrough", () => {
      let state: ModalState = INITIAL_MODAL_STATE;
      state = modalReducer(state, { type: "CHOOSE_AI" });
      state = modalReducer(state, {
        type: "STAGE_PHOTOS",
        photos: [photo("a")],
      });
      state = modalReducer(state, { type: "BEGIN_GENERATE" });
      state = modalReducer(state, {
        type: "GENERATE_FAILURE",
        reason: "network",
      });
      expect(state.kind).toBe("error");

      state = modalReducer(state, { type: "RETRY_FROM_ERROR" });
      expect(state.kind).toBe("processing");

      state = modalReducer(state, {
        type: "GENERATE_SUCCESS",
        draft: SAMPLE_DRAFT,
      });
      expect(state.kind).toBe("closed_success");
    });

    it("error → back to instructions → cancel preserves photos for manual flow", () => {
      const photos = [photo("a"), photo("b")];
      let state: ModalState = {
        kind: "error",
        reason: "low_confidence",
        staged: photos,
      };
      state = modalReducer(state, { type: "BACK_TO_INSTRUCTIONS" });
      expect(state).toEqual({ kind: "instructions", staged: photos });

      state = modalReducer(state, { type: "CANCEL_AI" });
      expect(state).toEqual({ kind: "closed_cancel", staged: photos });
    });
  });
});

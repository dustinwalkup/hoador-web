import { describe, it, expect } from "vitest";

import { type ImageFile } from "@/features/listings/form-schema/listing.schema";

import {
  aiDraftToInitialValues,
  computeAiPrefilledFields,
} from "../ai-draft-to-initial-values";
import { type AiDraft } from "../types";

const FULL_DRAFT: AiDraft = {
  name: "DeWalt 20V Cordless Drill",
  description: "A solid cordless drill for home and contractor use.",
  categoryId: "uuid-power-tools",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "good",
  specifications: { power: "20V MAX", weight: "3.4 lbs" },
  instructions: "Insert battery, select speed, pull trigger.",
  safetyNotes: "Wear safety glasses.",
};

const EMPTY_DRAFT: AiDraft = {
  name: null,
  description: null,
  categoryId: null,
  brand: null,
  model: null,
  condition: null,
  specifications: {},
  instructions: null,
  safetyNotes: null,
};

const SAMPLE_IMAGES: ImageFile[] = [
  { id: "img-1", url: "blob:preview-1", orderIndex: 0, status: "ready" },
  { id: "img-2", url: "blob:preview-2", orderIndex: 1, status: "ready" },
];

describe("aiDraftToInitialValues", () => {
  it("includes every field when the draft is fully populated", () => {
    const result = aiDraftToInitialValues(FULL_DRAFT, SAMPLE_IMAGES);
    expect(result).toEqual({
      name: FULL_DRAFT.name,
      description: FULL_DRAFT.description,
      categoryId: FULL_DRAFT.categoryId,
      brand: FULL_DRAFT.brand,
      model: FULL_DRAFT.model,
      condition: FULL_DRAFT.condition,
      specifications: FULL_DRAFT.specifications,
      instructions: FULL_DRAFT.instructions,
      safetyNotes: FULL_DRAFT.safetyNotes,
      images: SAMPLE_IMAGES,
    });
  });

  it("omits null fields so form defaults survive (Req 5.6)", () => {
    const result = aiDraftToInitialValues(EMPTY_DRAFT, []);
    expect(result).toEqual({ images: [] });
    expect("name" in result).toBe(false);
    expect("categoryId" in result).toBe(false);
    expect("condition" in result).toBe(false);
    expect("brand" in result).toBe(false);
    expect("specifications" in result).toBe(false);
  });

  it.each([
    ["name"],
    ["description"],
    ["categoryId"],
    ["brand"],
    ["model"],
    ["condition"],
    ["instructions"],
    ["safetyNotes"],
  ] as const)("omits %s individually when null", (field) => {
    const draft: AiDraft = { ...FULL_DRAFT, [field]: null };
    const result = aiDraftToInitialValues(draft, SAMPLE_IMAGES);
    expect(field in result).toBe(false);
  });

  it("omits specifications when the object is empty", () => {
    const draft: AiDraft = { ...FULL_DRAFT, specifications: {} };
    const result = aiDraftToInitialValues(draft, SAMPLE_IMAGES);
    expect("specifications" in result).toBe(false);
  });

  it("forwards the images array verbatim", () => {
    const result = aiDraftToInitialValues(FULL_DRAFT, SAMPLE_IMAGES);
    expect(result.images).toBe(SAMPLE_IMAGES);
  });

  it("forwards an empty images array (form's min-1 validator runs at submit)", () => {
    const result = aiDraftToInitialValues(FULL_DRAFT, []);
    expect(result.images).toEqual([]);
  });
});

describe("computeAiPrefilledFields", () => {
  it("returns an empty set for an empty draft", () => {
    expect(computeAiPrefilledFields(EMPTY_DRAFT).size).toBe(0);
  });

  it("returns all nine keys for a fully-populated draft", () => {
    const keys = computeAiPrefilledFields(FULL_DRAFT);
    expect(keys.size).toBe(9);
    expect(keys.has("name")).toBe(true);
    expect(keys.has("description")).toBe(true);
    expect(keys.has("categoryId")).toBe(true);
    expect(keys.has("brand")).toBe(true);
    expect(keys.has("model")).toBe(true);
    expect(keys.has("condition")).toBe(true);
    expect(keys.has("specifications")).toBe(true);
    expect(keys.has("instructions")).toBe(true);
    expect(keys.has("safetyNotes")).toBe(true);
  });

  it("excludes null fields", () => {
    const draft: AiDraft = {
      ...EMPTY_DRAFT,
      name: "Drill",
      categoryId: "uuid-power-tools",
      condition: "good",
    };
    const keys = computeAiPrefilledFields(draft);
    expect([...keys].sort()).toEqual(["categoryId", "condition", "name"]);
  });

  it("excludes specifications when the object is empty", () => {
    const draft: AiDraft = {
      ...FULL_DRAFT,
      specifications: {},
    };
    expect(computeAiPrefilledFields(draft).has("specifications")).toBe(false);
  });

  it("includes specifications when the object has any entries", () => {
    const draft: AiDraft = {
      ...EMPTY_DRAFT,
      specifications: { power: "20V" },
    };
    expect(computeAiPrefilledFields(draft).has("specifications")).toBe(true);
  });
});

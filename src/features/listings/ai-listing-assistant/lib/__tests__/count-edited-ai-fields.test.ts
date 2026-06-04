import { describe, expect, it } from "vitest";

import { type AiDraft } from "@/features/listings/ai-listing-assistant/types";
import { type CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

import { countEditedAiFields } from "../count-edited-ai-fields";

const FULL_DRAFT: AiDraft = {
  name: "DeWalt 20V Cordless Drill",
  description: "Solid cordless drill.",
  categoryId: "uuid-power-tools",
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "good",
  specifications: { power: "20V MAX" },
  instructions: "Insert battery and use trigger",
  safetyNotes: "Wear safety glasses",
};

function makeFinal(
  overrides: Partial<CreateListingFormDataClientType> = {},
): CreateListingFormDataClientType {
  return {
    name: FULL_DRAFT.name!,
    description: FULL_DRAFT.description!,
    categoryId: FULL_DRAFT.categoryId!,
    brand: FULL_DRAFT.brand ?? undefined,
    model: FULL_DRAFT.model ?? undefined,
    condition: FULL_DRAFT.condition!,
    dailyRate: 10,
    weeklyRate: undefined,
    monthlyRate: undefined,
    securityDeposit: 0,
    specifications: { ...FULL_DRAFT.specifications },
    instructions: FULL_DRAFT.instructions ?? undefined,
    safetyNotes: FULL_DRAFT.safetyNotes ?? undefined,
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "pickup_only",
    deliveryFee: 0,
    deliveryRadius: 0,
    setupAvailable: false,
    setupFee: 0,
    ownerPoliciesAcknowledged: true,
    images: [],
    ...overrides,
  };
}

describe("countEditedAiFields", () => {
  it("returns 0 when aiDraft is null (manual flow)", () => {
    expect(countEditedAiFields(null, makeFinal())).toBe(0);
  });

  it("returns 0 when no field has been edited", () => {
    expect(countEditedAiFields(FULL_DRAFT, makeFinal())).toBe(0);
  });

  it("counts a changed name as one edit", () => {
    const final = makeFinal({ name: "Edited drill name" });
    expect(countEditedAiFields(FULL_DRAFT, final)).toBe(1);
  });

  it("counts a changed brand as one edit", () => {
    expect(
      countEditedAiFields(FULL_DRAFT, makeFinal({ brand: "Milwaukee" })),
    ).toBe(1);
  });

  it("counts changes across multiple fields independently", () => {
    const final = makeFinal({
      name: "x",
      description: "y",
      condition: "fair",
    });
    expect(countEditedAiFields(FULL_DRAFT, final)).toBe(3);
  });

  it("ignores fields that AI did not emit (only counts prefilled keys)", () => {
    const draftWithoutBrand: AiDraft = { ...FULL_DRAFT, brand: null };
    // User filled in brand — but AI never emitted one, so it doesn't count
    // as an "AI edit".
    const final = makeFinal({ brand: "User-typed-brand" });
    expect(countEditedAiFields(draftWithoutBrand, final)).toBe(0);
  });

  it("counts a category swap as one edit", () => {
    expect(
      countEditedAiFields(FULL_DRAFT, makeFinal({ categoryId: "uuid-other" })),
    ).toBe(1);
  });

  it("counts a condition change as one edit", () => {
    expect(
      countEditedAiFields(FULL_DRAFT, makeFinal({ condition: "poor" })),
    ).toBe(1);
  });

  it("counts edited specifications as one edit (the whole record counts once)", () => {
    expect(
      countEditedAiFields(
        FULL_DRAFT,
        makeFinal({ specifications: { power: "18V MAX" } }),
      ),
    ).toBe(1);
  });

  it("treats whitespace-only edits as not edited (trim normalization)", () => {
    expect(
      countEditedAiFields(
        FULL_DRAFT,
        makeFinal({ name: `  ${FULL_DRAFT.name}  ` }),
      ),
    ).toBe(0);
  });

  it("counts a removed-from-form (empty) AI-prefilled field as an edit", () => {
    expect(
      countEditedAiFields(FULL_DRAFT, makeFinal({ instructions: "" })),
    ).toBe(1);
  });
});

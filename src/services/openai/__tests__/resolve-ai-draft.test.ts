import { describe, it, expect } from "vitest";

import { resolveAiDraft } from "../resolve-ai-draft";

const CATEGORIES = [
  { id: "uuid-power-tools", name: "Power Tools" },
  { id: "uuid-hand-tools", name: "Hand Tools" },
  { id: "uuid-gardening", name: "Gardening" },
  { id: "uuid-misc", name: "Miscellaneous" },
];

function validRaw(overrides: Record<string, unknown> = {}) {
  return {
    name: "DeWalt 20V Cordless Drill",
    description: "A solid cordless drill for home and contractor use.",
    categoryName: "Power Tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good",
    specifications: { power: "20V MAX", weight: "3.4 lbs" },
    instructions: "Insert battery, select speed, pull trigger.",
    safetyNotes: "Wear safety glasses.",
    ...overrides,
  };
}

describe("resolveAiDraft", () => {
  it("returns a fully-resolved draft on the happy path", () => {
    const draft = resolveAiDraft(validRaw(), CATEGORIES);
    expect(draft).toEqual({
      name: "DeWalt 20V Cordless Drill",
      description: "A solid cordless drill for home and contractor use.",
      categoryId: "uuid-power-tools",
      brand: "DeWalt",
      model: "DCD777C2",
      condition: "good",
      specifications: { power: "20V MAX", weight: "3.4 lbs" },
      instructions: "Insert battery, select speed, pull trigger.",
      safetyNotes: "Wear safety glasses.",
    });
  });

  it("matches category names case-insensitively with surrounding whitespace", () => {
    const draft = resolveAiDraft(
      validRaw({ categoryName: "  power tools  " }),
      CATEGORIES,
    );
    expect(draft?.categoryId).toBe("uuid-power-tools");
  });

  it("leaves categoryId null when no category matches (Req 5.3)", () => {
    const draft = resolveAiDraft(
      validRaw({ categoryName: "Heavy Machinery" }),
      CATEGORIES,
    );
    expect(draft?.categoryId).toBeNull();
  });

  it("leaves categoryId null when categoryName is blank", () => {
    const draft = resolveAiDraft(validRaw({ categoryName: "   " }), CATEGORIES);
    expect(draft?.categoryId).toBeNull();
  });

  it("leaves condition null when AI returns legacy 'excellent' (Req 5.5)", () => {
    const draft = resolveAiDraft(
      validRaw({ condition: "excellent" }),
      CATEGORIES,
    );
    expect(draft?.condition).toBeNull();
  });

  it("leaves condition null for non-canonical casing (strict enum match)", () => {
    const draft = resolveAiDraft(validRaw({ condition: "GOOD" }), CATEGORIES);
    expect(draft?.condition).toBeNull();
  });

  it("accepts all canonical condition values", () => {
    for (const c of ["new", "good", "fair", "poor"] as const) {
      const draft = resolveAiDraft(validRaw({ condition: c }), CATEGORIES);
      expect(draft?.condition).toBe(c);
    }
  });

  it("preserves null brand and model (Req 5.6 — favor blank over fabricated)", () => {
    const draft = resolveAiDraft(
      validRaw({ brand: null, model: null }),
      CATEGORIES,
    );
    expect(draft?.brand).toBeNull();
    expect(draft?.model).toBeNull();
  });

  it("normalizes empty-string brand/model to null", () => {
    const draft = resolveAiDraft(
      validRaw({ brand: "", model: "   " }),
      CATEGORIES,
    );
    expect(draft?.brand).toBeNull();
    expect(draft?.model).toBeNull();
  });

  it("drops empty-string entries from specifications", () => {
    const draft = resolveAiDraft(
      validRaw({
        specifications: { power: "20V", weight: "", dimensions: "  " },
      }),
      CATEGORIES,
    );
    expect(draft?.specifications).toEqual({ power: "20V" });
  });

  it("drops null-valued specification entries (model emits null for 'if applicable' fields)", () => {
    const draft = resolveAiDraft(
      validRaw({
        specifications: {
          power: "120 V AC/DC, 15 A, 5500 RPM",
          weight: null,
          dimensions: null,
          material: null,
        },
      }),
      CATEGORIES,
    );
    expect(draft).not.toBeNull();
    expect(draft?.specifications).toEqual({
      power: "120 V AC/DC, 15 A, 5500 RPM",
    });
  });

  it("normalizes missing optional text fields to null", () => {
    const draft = resolveAiDraft(
      validRaw({ instructions: "", safetyNotes: "   " }),
      CATEGORIES,
    );
    expect(draft?.instructions).toBeNull();
    expect(draft?.safetyNotes).toBeNull();
  });

  it("returns null when raw input is malformed (route maps to low_confidence)", () => {
    expect(resolveAiDraft(null, CATEGORIES)).toBeNull();
    expect(resolveAiDraft("not json", CATEGORIES)).toBeNull();
    expect(resolveAiDraft(42, CATEGORIES)).toBeNull();
    expect(
      resolveAiDraft({ specifications: "this should be a record" }, CATEGORIES),
    ).toBeNull();
  });

  it("treats an entirely-missing payload as a parseable empty draft (route enforces low-signal check)", () => {
    // All fields nullish — schema parses, but the resulting draft has no
    // name/categoryId so the route will treat it as low_confidence.
    const draft = resolveAiDraft({}, CATEGORIES);
    expect(draft).toEqual({
      name: null,
      description: null,
      categoryId: null,
      brand: null,
      model: null,
      condition: null,
      specifications: {},
      instructions: null,
      safetyNotes: null,
    });
  });
});

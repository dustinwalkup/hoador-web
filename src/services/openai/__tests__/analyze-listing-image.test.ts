import { describe, expect, it } from "vitest";

import { __testing } from "../analyze-listing-image";

const { buildPrompt } = __testing;

const CATEGORY_NAMES = [
  "Power Tools",
  "Hand Tools",
  "Gardening",
  "Ladders & Access",
  "Construction",
  "Cleaning",
  "Automotive",
  "Party Equipment",
  "Kids & Baby",
  "Miscellaneous",
];

const CONDITION_ENUM = ["new", "good", "fair", "poor"] as const;

describe("analyze-listing-image: buildPrompt", () => {
  it("frames the role around items, not just tools (broad marketplace language)", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    expect(prompt).toMatch(
      /rental marketplace for items, tools, and equipment/,
    );
    expect(prompt).toMatch(/the item shown/);
    // Generic "listing form", not "tool listing form"
    expect(prompt).toMatch(/listing form/);
    expect(prompt).not.toMatch(/tool listing form/);
  });

  it("injects every active category name into the allowed list (Req 5.4)", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    for (const name of CATEGORY_NAMES) {
      expect(prompt).toContain(name);
    }
  });

  it("falls back to 'Miscellaneous' rather than 'closest' when nothing fits (Req 5.3)", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    expect(prompt).toMatch(/use "Miscellaneous"/);
    expect(prompt).not.toMatch(/choose the closest/);
  });

  it("injects the canonical condition enum and forbids legacy 'excellent'", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    expect(prompt).toContain("new, good, fair, poor");
    expect(prompt).toMatch(/"excellent" is not allowed/);
  });

  it("specifications guidance is free-form with category-appropriate examples", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    // Free-form: examples cover non-tool categories too
    expect(prompt).toMatch(/capacity.*cooler/i);
    expect(prompt).toMatch(/age range.*baby/i);
    expect(prompt).toMatch(/1.4.*keys/);
    // Pinned to string values so the resolver doesn't have to coerce
    expect(prompt).toMatch(/Values must be plain strings/);
    // No hardcoded power/weight/dimensions/material skeleton
    expect(prompt).not.toMatch(/"power": "string \(if applicable\)"/);
  });

  it("brand/model rule favors null over guessing (Req 5.6)", () => {
    const prompt = buildPrompt({
      categoryNames: CATEGORY_NAMES,
      conditionEnum: CONDITION_ENUM,
    });
    expect(prompt).toMatch(/return null when the value is not clearly visible/);
    expect(prompt).toMatch(/Do NOT guess/);
  });
});

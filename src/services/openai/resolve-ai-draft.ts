import {
  CANONICAL_CONDITION_ENUM,
  type AiDraft,
  type CanonicalCondition,
  rawAiResponseSchema,
} from "@/features/listings/ai-listing-assistant/types";

interface CategoryRef {
  id: string;
  name: string;
}

/**
 * Translate a raw OpenAI response into the canonical `AiDraft` contract the
 * client form consumes. Returns `null` when the response cannot be parsed —
 * the route maps that to a `low_confidence` failure rather than a 500.
 *
 * Pure function, no I/O.
 */
export function resolveAiDraft(
  raw: unknown,
  categories: CategoryRef[],
): AiDraft | null {
  const parsed = rawAiResponseSchema.safeParse(raw);
  if (!parsed.success) return null;

  const data = parsed.data;

  return {
    name: blankToNull(data.name),
    description: blankToNull(data.description),
    categoryId: resolveCategoryId(data.categoryName, categories),
    brand: blankToNull(data.brand),
    model: blankToNull(data.model),
    condition: resolveCondition(data.condition),
    specifications: dropEmptyValues(data.specifications),
    instructions: blankToNull(data.instructions),
    safetyNotes: blankToNull(data.safetyNotes),
  };
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveCategoryId(
  categoryName: string,
  categories: CategoryRef[],
): string | null {
  const needle = categoryName.trim().toLowerCase();
  if (needle.length === 0) return null;
  const match = categories.find((c) => c.name.trim().toLowerCase() === needle);
  return match ? match.id : null;
}

function resolveCondition(value: string): CanonicalCondition | null {
  return (CANONICAL_CONDITION_ENUM as readonly string[]).includes(value)
    ? (value as CanonicalCondition)
    : null;
}

function dropEmptyValues(
  specs: Record<string, string | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(specs)) {
    if (typeof value === "string" && value.trim().length > 0) {
      out[key] = value;
    }
  }
  return out;
}

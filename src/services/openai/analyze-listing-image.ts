import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing credentials. Please set the OPENAI_API_KEY environment variable.",
      );
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface AnalyzeListingImageOptions {
  /** Active category names rendered into the prompt's allowed-category list. */
  categoryNames: string[];
  /** Canonical condition enum the AI must emit (no legacy values like `excellent`). */
  conditionEnum: readonly string[];
}

function buildPrompt(opts: AnalyzeListingImageOptions): string {
  const categoryList = opts.categoryNames.join(", ");
  const conditionList = opts.conditionEnum.join(", ");

  return `You're assisting with a rental marketplace for items, tools, and equipment. Analyze the item shown in the provided images (all images are of the same item from different angles) and return ONLY a valid JSON object to help prefill a listing form.

IMPORTANT: These are multiple images of the SAME item from different angles. Use all images to get the most complete and accurate information. Pay special attention to any visible make, model, or brand information that might be clearly printed on the item or its label.

Return ONLY a JSON object with this exact structure:

{
  "name": "string (listing name, max 255 chars)",
  "description": "string (detailed description for renters, 2-3 sentences)",
  "categoryName": "string (must be one of: ${categoryList})",
  "brand": "string (brand name if clearly visible, otherwise null)",
  "model": "string (model number if clearly visible, otherwise null)",
  "condition": "string (must be one of: ${conditionList})",
  "specifications": { },
  "instructions": "string (brief usage instructions if obvious from images)",
  "safetyNotes": "string (safety considerations if applicable)"
}

Rules:
- For "categoryName", you MUST use one of these exact values (case-sensitive): ${categoryList}. If none clearly fit, use "Miscellaneous".
- For "condition", you MUST use exactly one of these lowercase values: ${conditionList}. Do not invent other values (e.g. "excellent" is not allowed).
- For "brand" and "model", return null when the value is not clearly visible on the item. Do NOT guess.
- For "specifications", include 1–4 short, lowercase, common-noun keys appropriate to this item (examples: "power" for a drill, "capacity" for a cooler, "seating" for a tent, "age range" for a baby item, "weight", "dimensions", "material"). Omit any key you can't determine from the images. Use {} if none apply. Values must be plain strings — no booleans, numbers, arrays, or nested objects.

Return ONLY the JSON object, no additional text, formatting, or markdown.`;
}

/**
 * Result of an `analyzeListingImage` call.
 *
 * The model can respond in two distinct ways to a vision request:
 *   - `parsed`: it complied with the JSON-only contract; `data` is the raw
 *     object (still subject to `resolveAiDraft` shape validation downstream).
 *   - `refused`: it returned prose instead (e.g. "I'm sorry, this isn't an
 *     item I can list" for an off-topic image). We surface this as a distinct
 *     channel rather than throwing, so the route can classify it as a
 *     content failure (`unsuitable_content`) instead of an upstream 500.
 */
export type AnalyzeListingImageResult =
  | { kind: "parsed"; data: unknown }
  | { kind: "refused"; raw: string };

export async function analyzeListingImage(
  imageUrls: string | string[],
  opts: AnalyzeListingImageOptions,
): Promise<AnalyzeListingImageResult> {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const prompt = buildPrompt(opts);

  const res = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You're a helpful assistant for a rental marketplace for items, tools, and equipment. You analyze multiple images of the same item to provide comprehensive information.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...urls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      },
    ],
    temperature: 0.4,
    max_tokens: 800,
  });

  const message = res.choices[0].message.content;
  if (!message) throw new Error("No message returned from OpenAI");

  const cleanedMessage = message
    .trim()
    .replace(/^```json\s*/, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleanedMessage);
    if (process.env.NODE_ENV !== "production") {
      console.log("[analyze-listing-image] raw response:", message);
      console.log(
        "[analyze-listing-image] parsed:",
        JSON.stringify(parsed, null, 2),
      );
    }
    return { kind: "parsed", data: parsed };
  } catch {
    // The model returned prose instead of JSON — typically a refusal
    // ("I'm sorry, this image isn't suitable…") for off-topic or unsafe
    // images. Surface as a tagged result so the route maps it to
    // `unsuitable_content`, not a 500.
    if (process.env.NODE_ENV !== "production") {
      console.log("[analyze-listing-image] model refused (non-JSON):", message);
    }
    return { kind: "refused", raw: message };
  }
}

export const __testing = { buildPrompt };

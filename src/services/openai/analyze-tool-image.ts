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

export interface AnalyzeToolImageOptions {
  /** Active category names rendered into the prompt's allowed-category list. */
  categoryNames: string[];
  /** Canonical condition enum the AI must emit (no legacy values like `excellent`). */
  conditionEnum: readonly string[];
}

function buildPrompt(opts: AnalyzeToolImageOptions): string {
  const categoryList = opts.categoryNames.join(", ");
  const conditionList = opts.conditionEnum.join(", ");

  return `You're assisting with a tool rental platform. Analyze the tool shown in the provided images (all images are of the same tool from different angles) and return ONLY a valid JSON object to help prefill a tool listing form.

IMPORTANT: These are multiple images of the SAME tool from different angles. Use all images to get the most complete and accurate information. Pay special attention to any visible make, model, or brand information that might be clearly printed on the tool.

Return ONLY a JSON object with this exact structure:

{
  "name": "string (tool name, max 255 chars)",
  "description": "string (detailed description for renters, 2-3 sentences)",
  "categoryName": "string (must be one of: ${categoryList})",
  "brand": "string (brand name if clearly visible, otherwise null)",
  "model": "string (model number if clearly visible, otherwise null)",
  "condition": "string (must be one of: ${conditionList})",
  "specifications": {
    "power": "string (if applicable)",
    "weight": "string (if applicable)",
    "dimensions": "string (if applicable)",
    "material": "string (if applicable)"
  },
  "instructions": "string (brief usage instructions if obvious from images)",
  "safetyNotes": "string (safety considerations if applicable)"
}

Rules:
- For "categoryName", you MUST use one of these exact values (case-sensitive): ${categoryList}. If none clearly fit, choose the closest.
- For "condition", you MUST use exactly one of these lowercase values: ${conditionList}. Do not invent other values (e.g. "excellent" is not allowed).
- For "brand" and "model", return null when the value is not clearly visible on the tool. Do NOT guess.

Return ONLY the JSON object, no additional text, formatting, or markdown.`;
}

export async function analyzeToolImage(
  imageUrls: string | string[],
  opts: AnalyzeToolImageOptions,
): Promise<unknown> {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const prompt = buildPrompt(opts);

  const res = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You're a helpful assistant for a tool rental platform. You analyze multiple images of the same tool to provide comprehensive information.",
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

  try {
    const cleanedMessage = message
      .trim()
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "");
    return JSON.parse(cleanedMessage);
  } catch (err) {
    console.error("Failed to parse OpenAI JSON response:", message);
    console.error("Parse error:", err);
    throw new Error(
      `Failed to parse OpenAI response: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

/** Exported for testing — lets specs assert the rendered prompt body. */
export const __testing = { buildPrompt };

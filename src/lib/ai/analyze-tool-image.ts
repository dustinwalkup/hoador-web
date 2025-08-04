import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const prompt = `You're assisting with a tool rental platform. Analyze the tool shown in the provided images (all images are of the same tool from different angles) and return ONLY a valid JSON object to help prefill a tool listing form.

IMPORTANT: These are multiple images of the SAME tool from different angles. Use all images to get the most complete and accurate information. Pay special attention to any visible make, model, or brand information that might be clearly printed on the tool.

Return ONLY a JSON object with this exact structure:

{
  "name": "string (tool name, max 255 chars)",
  "description": "string (detailed description for renters, 2-3 sentences)",
  "categoryName": "string (must be one of: Power Tools, Hand Tools, Gardening, Ladders & Access, Construction, Cleaning, Automotive, Party Equipment)",
  "brand": "string (brand name if visible, otherwise null)",
  "model": "string (model number if visible, otherwise null)",
  "condition": "string (must be one of: excellent, good, fair, poor)",
  "specifications": {
    "power": "string (if applicable)",
    "weight": "string (if applicable)",
    "dimensions": "string (if applicable)",
    "material": "string (if applicable)"
  },
  "instructions": "string (brief usage instructions if obvious from images)",
  "safetyNotes": "string (safety considerations if applicable)"
}

Example response:
{
  "name": "DeWalt 20V MAX Cordless Drill",
  "description": "Professional-grade cordless drill with brushless motor and 20V MAX battery system. Perfect for contractors and serious DIY enthusiasts. Includes keyless chuck and LED worklight.",
  "categoryName": "Power Tools",
  "brand": "DeWalt",
  "model": "DCD777C2",
  "condition": "good",
  "specifications": {
    "power": "20V MAX",
    "weight": "3.4 lbs",
    "dimensions": "8.5\" x 3.8\" x 8.9\"",
    "material": "plastic and metal"
  },
  "instructions": "Insert battery, select speed setting, and use trigger to operate. Use keyless chuck to change bits.",
  "safetyNotes": "Wear safety glasses. Keep hands away from rotating parts. Ensure workpiece is secured before drilling."
}

Return ONLY the JSON object, no additional text, formatting, or markdown.`;

export async function analyzeToolImage(imageUrls: string | string[]) {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];

  const res = await openai.chat.completions.create({
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
    // Clean the message to remove any markdown formatting
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

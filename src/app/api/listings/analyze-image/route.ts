import { NextRequest, NextResponse } from "next/server";
import { analyzeToolImage } from "@/services/openai/analyze-tool-image";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";
import { z } from "zod";

const analyzeImageSchema = z.object({
  imageUrls: z.union([
    z.string(),
    z.array(z.string()),
  ]),
});

/**
 * POST /api/listings/analyze-image
 * Analyze tool image using OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await parseFormData(request);

    // Validate request body
    const validationResult = analyzeImageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { imageUrls } = validationResult.data;

    // Analyze the image(s)
    const result = await analyzeToolImage(imageUrls);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

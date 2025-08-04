"use server";

import { analyzeToolImage } from "@/lib/ai/analyze-tool-image";

export async function analyzeToolImageAction(imageUrls: string | string[]) {
  try {
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    const result = await analyzeToolImage(urls);
    return { success: true, data: result };
  } catch (error) {
    console.error("Analysis error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}

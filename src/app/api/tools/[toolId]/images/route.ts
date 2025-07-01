import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { toolImages } from "@/db/schemas/tools.schema";

export async function GET(
  request: NextRequest,
  { params }: { params: { toolId: string } },
) {
  try {
    const toolId = await params.toolId;

    // Validate toolId exists and is a valid UUID
    if (!toolId || toolId === "") {
      return NextResponse.json(
        { error: "Tool ID is required" },
        { status: 400 },
      );
    }

    // Get all images for this tool, ordered by orderIndex
    const images = await db
      .select()
      .from(toolImages)
      .where(eq(toolImages.toolId, toolId))
      .orderBy(toolImages.orderIndex);

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error) {
    console.error("Get images error:", error);
    return NextResponse.json(
      { error: "Failed to get images" },
      { status: 500 },
    );
  }
}

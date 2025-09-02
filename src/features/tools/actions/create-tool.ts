"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { uploadToBlob } from "@/services/vercel-blob";

import {
  createToolSchemaServer,
  type CreateToolFormDataServerType,
} from "../form-schema/tool.schema";
import { getCurrentUserId } from "../../authentication/auth.utils";
import { db } from "@/db/db";
import { toolImages } from "@/db/schemas/tools.schema";
import { toolDAL } from "../../../dal";

// Separate action for uploading images
export async function uploadToolImage(
  file: File,
  toolId: string,
  orderIndex: number,
) {
  try {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `tools/${toolId}/${timestamp}-${sanitizedName}`;

    const blob = await uploadToBlob(filename, file);

    // Save to database
    const [savedImage] = await db
      .insert(toolImages)
      .values({
        toolId,
        imageUrl: blob.url,
        blobPathname: blob.pathname,
        orderIndex,
      })
      .returning();

    return { success: true, image: savedImage };
  } catch (error) {
    console.error("Error uploading image:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

export async function createTool(formData: CreateToolFormDataServerType) {
  console.log("CREATE TOOL formData", formData);
  // Validate the form data
  const validationResult = createToolSchemaServer.safeParse(formData);

  if (!validationResult.success) {
    return {
      error: "Validation failed",
      details: validationResult.error.flatten(),
    };
  }

  const validatedData = validationResult.data;

  // Get current user ID
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Unauthorized: User not authenticated" };
  }

  // Create the tool first
  const { data: tool, error } = await tryCatch(
    toolDAL.createTool(userId, validatedData),
  );

  if (error) {
    console.error("Error creating tool:", error);

    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "An unexpected error occurred while creating the tool" };
  }

  // Create the tool
  if (!tool) {
    return { error: "Failed to create tool" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/tools");

  return { success: true, toolId: tool.id };
}

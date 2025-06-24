"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import {
  createToolSchema,
  type CreateToolFormData,
} from "../form-schemas/tool.schema";
import { ToolDAL } from "../dal/tool.dal";
import { getCurrentUserId } from "../auth/auth-utils";

const toolDAL = new ToolDAL();

export async function createTool(formData: CreateToolFormData) {
  // Validate the form data
  const validationResult = createToolSchema.safeParse(formData);

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
}

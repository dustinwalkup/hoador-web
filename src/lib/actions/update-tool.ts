"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";

import {
  createToolSchemaServer,
  type CreateToolFormDataServerType,
} from "../form-schemas/tool.schema";
import { getCurrentUserId } from "../auth/auth.utils";
import { toolDAL } from "../../dal";

export async function updateTool(
  toolId: string,
  formData: CreateToolFormDataServerType,
) {
  console.log("FORM DATA", formData);
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

  // Update the tool
  const { data: tool, error } = await tryCatch(
    toolDAL.updateTool(toolId, userId, validatedData),
  );

  if (error) {
    console.error("Error updating tool:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unexpected error occurred while updating the tool" };
  }

  if (!tool) {
    return { error: "Failed to update tool" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/tools");

  return { success: true, toolId };
}

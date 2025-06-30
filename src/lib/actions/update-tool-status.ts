"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";
import { z } from "zod";
import { toolDAL } from "../dal";

const updateToolStatusSchema = z.object({
  status: z.enum(["available", "maintenance", "inactive"]),
});

type UpdateToolStatusData = z.infer<typeof updateToolStatusSchema>;

export async function updateToolStatus(
  toolId: string,
  formData: UpdateToolStatusData,
) {
  // Validate the form data
  const validationResult = updateToolStatusSchema.safeParse(formData);

  if (!validationResult.success) {
    return {
      error: "Validation failed",
      details: validationResult.error.flatten(),
    };
  }

  const validatedData = validationResult.data;

  // Update the tool status
  const { data: tool, error } = await tryCatch(
    toolDAL.updateToolStatus(toolId, validatedData.status),
  );

  if (error) {
    console.error("Error updating tool status:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return {
      error: "An unexpected error occurred while updating the tool status",
    };
  }

  if (!tool) {
    return { error: "Failed to update tool status" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/tools");
  revalidatePath("/dashboard/explore");

  return { success: true, tool };
}

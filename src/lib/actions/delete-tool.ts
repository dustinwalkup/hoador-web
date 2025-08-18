"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";

import { toolDAL } from "../../dal";

export async function deleteTool(toolId: string) {
  // Delete the tool
  const { error } = await tryCatch(toolDAL.deleteTool(toolId));

  if (error) {
    console.error("Error deleting tool:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unexpected error occurred while deleting the tool" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/tools");
  revalidatePath("/dashboard/explore");

  return { success: true };
}

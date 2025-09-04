"use server";

import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";

import { listingDAL } from "../../../dal";

export async function deleteListing(listingId: string) {
  // Delete the listing
  const { error } = await tryCatch(listingDAL.deleteListing(listingId));

  if (error) {
    console.error("Error deleting listing:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unexpected error occurred while deleting the listing" };
  }

  // Revalidate relevant paths
  revalidatePath("/dashboard/garage");
  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard/explore");

  return { success: true };
}

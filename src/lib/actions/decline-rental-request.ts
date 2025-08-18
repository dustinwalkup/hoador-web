"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

const declineRequestSchema = z.object({
  requestId: z.string().uuid(),
  rejectionReason: z.string().min(1, "Rejection reason is required"),
});

export async function declineRentalRequest(
  data: z.infer<typeof declineRequestSchema>,
) {
  // Validate input data
  const parseResult = declineRequestSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid data provided",
    };
  }

  const validatedData = parseResult.data;

  const { error } = await tryCatch(
    rentalDAL.declineRentalRequest(
      validatedData.requestId,
      validatedData.rejectionReason,
    ),
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/incoming");

  return {
    success: true,
  };
}

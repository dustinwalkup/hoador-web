"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL } from "@/lib/dal";
import { tryCatch } from "@walkup/walkup-utils";

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

export async function approveRentalRequest(
  data: z.infer<typeof approveRequestSchema>,
) {
  // Validate input data
  const parseResult = approveRequestSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid data provided",
    };
  }

  const validatedData = parseResult.data;

  const { error } = await tryCatch(
    rentalDAL.approveRentalRequest(validatedData.requestId, {
      pickupInstructions: validatedData.pickupInstructions,
      returnInstructions: validatedData.returnInstructions,
    }),
  );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/lending/active");

  return {
    success: true,
  };
}

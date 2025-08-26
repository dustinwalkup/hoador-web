"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL, userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";

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

  const { data: rentalRequest, error: fetchError } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalRequestById(validatedData.requestId);
    })(),
  );

  if (fetchError || !rentalRequest) {
    return {
      success: false,
      error: fetchError?.message || "Rental request not found",
    };
  }

  if (!rentalRequest.paymentMethodId) {
    return {
      success: false,
      error: "No payment method on file for renter",
    };
  }

  // Get the renter's Stripe customer ID from the users table
  const { data: renterUser, error: userError } = await tryCatch(
    (async () => {
      return await userDAL.getUserById(rentalRequest.renterId);
    })(),
  );

  if (userError || !renterUser) {
    return {
      success: false,
      error: userError?.message || "Renter not found",
    };
  }

  if (!renterUser.stripeCustomerId) {
    return {
      success: false,
      error: "Renter does not have a Stripe customer ID",
    };
  }

  // Create a PaymentIntent in Stripe
  const amountInCents = Math.round(Number(rentalRequest.totalAmount) * 100);

  const { data: paymentIntent, error: stripeError } = await tryCatch(
    (async () => {
      return await PAYMENT_SERVER_INSTANCE.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        customer: renterUser.stripeCustomerId || undefined,
        payment_method: rentalRequest.paymentMethodId || undefined,
        off_session: true, // renter doesn't need to be online
        confirm: true, // try to confirm immediately
        metadata: {
          rentalRequestId: rentalRequest.id,
          toolId: rentalRequest.toolId,
          ownerId: rentalRequest.ownerId,
          renterId: rentalRequest.renterId,
        },
      });
    })(),
  );

  if (stripeError || !paymentIntent) {
    return {
      success: false,
      error: stripeError?.message || "Failed to process payment",
    };
  }

  // Check if payment was successful
  if (paymentIntent.status !== "succeeded") {
    return {
      success: false,
      error: `Payment failed with status: ${paymentIntent.status}`,
    };
  }

  // Now approve the rental request
  const { error: approvalError } = await tryCatch(
    (async () => {
      return await rentalDAL.approveRentalRequest(validatedData.requestId, {
        pickupInstructions: validatedData.pickupInstructions,
        returnInstructions: validatedData.returnInstructions,
      });
    })(),
  );

  if (approvalError) {
    return {
      success: false,
      error: approvalError.message,
    };
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/lending/active");

  return {
    success: true,
  };
}

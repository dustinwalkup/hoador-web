import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL } from "@/dal";
import { generateAndStoreRentalAgreement } from "@/services/playwright/generate-rental-agreements";

const bodySchema = z.object({
  rentalRequestId: z.string().uuid(),
});

/**
 * POST /api/internal/generate-rental-agreement
 * Worker entrypoint for generating and storing a rental agreement PDF.
 * Protected by INTERNAL_API_SECRET. Invoked fire-and-forget from approve route.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!internalSecret) {
      console.error("INTERNAL_API_SECRET not configured");
      return NextResponse.json(
        { error: "Internal API secret not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${internalSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parseResult = bodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid body; rentalRequestId (uuid) required" },
        { status: 400 },
      );
    }

    const { rentalRequestId } = parseResult.data;

    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalRequestId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: "Rental request not found" },
        { status: 404 },
      );
    }

    if (rentalRequest.status !== "approved") {
      return NextResponse.json(
        { error: "Rental request is not approved" },
        { status: 400 },
      );
    }

    const url = await generateAndStoreRentalAgreement(rentalRequestId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error(
      "Rental agreement generation failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate rental agreement",
      },
      { status: 500 },
    );
  }
}

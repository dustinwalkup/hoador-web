import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
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
async function postHandler(request: NextRequest) {
  try {
    console.log("[pdf-gen-route] hit");
    const authHeader = request.headers.get("authorization");
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!internalSecret || internalSecret === "your-internal-api-secret-here") {
      console.error("[pdf-gen-route] INTERNAL_API_SECRET not configured");
      return NextResponse.json(
        { error: "Internal API secret not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${internalSecret}`) {
      console.warn("[pdf-gen-route] auth mismatch");
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
    console.log("[pdf-gen-route] generating for", rentalRequestId);

    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalRequestId),
    );

    if (fetchError || !rentalRequest) {
      console.warn("[pdf-gen-route] rental request not found", rentalRequestId);
      return NextResponse.json(
        { error: "Rental request not found" },
        { status: 404 },
      );
    }

    if (rentalRequest.status !== "approved") {
      console.warn("[pdf-gen-route] not approved, status:", rentalRequest.status);
      return NextResponse.json(
        { error: "Rental request is not approved" },
        { status: 400 },
      );
    }

    const url = await generateAndStoreRentalAgreement(rentalRequestId);
    console.log("[pdf-gen-route] success", { rentalRequestId, url });
    return NextResponse.json({ url });
  } catch (error) {
    console.error(
      "[pdf-gen-route] generation failed:",
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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/internal/generate-rental-agreement",
);

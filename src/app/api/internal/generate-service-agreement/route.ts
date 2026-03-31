import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";

import { serviceBookingDAL } from "@/dal";
import { generateAndStoreServiceAgreement } from "@/services/playwright/generate-service-agreements";

const bodySchema = z.object({
  serviceBookingId: z.string().uuid(),
});

/**
 * POST /api/internal/generate-service-agreement
 * Worker entrypoint for generating and storing a service agreement PDF.
 * Protected by INTERNAL_API_SECRET. Invoked fire-and-forget from accept flow.
 */
async function postHandler(request: NextRequest) {
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
        { error: "Invalid body; serviceBookingId (uuid) required" },
        { status: 400 },
      );
    }

    const { serviceBookingId } = parseResult.data;

    const { data: booking, error: fetchError } = await tryCatch(
      serviceBookingDAL.getById(serviceBookingId),
    );

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Service booking not found" },
        { status: 404 },
      );
    }

    if (booking.status !== "accepted") {
      return NextResponse.json(
        { error: "Service booking is not accepted" },
        { status: 400 },
      );
    }

    const url = await generateAndStoreServiceAgreement(serviceBookingId);
    return NextResponse.json({ url });
  } catch (error) {
    console.error(
      "Service agreement generation failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate service agreement",
      },
      { status: 500 },
    );
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/internal/generate-service-agreement",
);

import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { serviceBookingDAL } from "@/dal";
import { createServiceBookingSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceBookingService } from "@/features/services/services/service-booking-service";

/**
 * GET /api/services/bookings?role=requester|provider
 * Bookings for the current user in the given role.
 */
async function getListHandler(request: NextRequest) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const role = request.nextUrl.searchParams.get("role");
    if (role !== "requester" && role !== "provider") {
      return NextResponse.json(
        { error: "Query parameter role must be requester or provider" },
        { status: 400 },
      );
    }

    const { data, error } = await tryCatch(
      role === "requester"
        ? serviceBookingDAL.findByRequesterForDashboard(userId)
        : serviceBookingDAL.findByProviderForDashboard(userId),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ bookings: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/services/bookings
 * Request a booking for a service listing.
 */
async function postHandler(request: NextRequest) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await parseFormData(request);
    const parsed = createServiceBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { data, error } = await tryCatch(
      ServiceBookingService.createBooking(parsed.data, userId, {
        ipAddress,
        userAgent,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      bookingId: data.id,
      status: "pending" as const,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getListHandler,
  "GET /api/services/bookings",
);

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings",
);

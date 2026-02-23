import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
import type { UserStatus, UserType } from "@/dal/types";

/**
 * GET /api/admin/users
 * Fetch paginated users for admin. Default sort: recently signed up first.
 * Query: search, status, userType, page, limit
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") ?? undefined;
    const status = (searchParams.get("status") || undefined) as
      | UserStatus
      | undefined;
    const userType = (searchParams.get("userType") || undefined) as
      | UserType
      | undefined;
    const inactiveDaysParam = searchParams.get("inactiveDays");
    const inactiveDays =
      inactiveDaysParam !== null && inactiveDaysParam !== ""
        ? parseInt(inactiveDaysParam, 10)
        : undefined;
    const sortBy = (
      searchParams.get("sortBy") === "lastActiveAt" ? "lastActiveAt" : undefined
    ) as "createdAt" | "lastActiveAt" | undefined;

    const result = await userDAL.getUsersForAdmin({
      search: search || undefined,
      status,
      userType,
      page,
      limit,
      inactiveDays:
        inactiveDays != null && !Number.isNaN(inactiveDays)
          ? inactiveDays
          : undefined,
      sortBy,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

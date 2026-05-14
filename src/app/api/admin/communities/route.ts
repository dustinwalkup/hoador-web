import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  parseFormData,
  handleApiError,
} from "@/lib/api/route-helpers";
import type { NewCommunity } from "@/db/schemas/communities.schema";

/**
 * GET /api/admin/communities?page&limit&includeStats&sortBy&sortOrder
 * Paginated list of communities for the admin CRUD UI.
 * Requires admin authentication.
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const includeStats = searchParams.get("includeStats") === "true";
    const sortByParam = searchParams.get("sortBy");
    const sortBy = (
      sortByParam === "memberCount" || sortByParam === "createdAt"
        ? sortByParam
        : "name"
    ) as "name" | "memberCount" | "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    const result = await communityDAL.listCommunities({
      page,
      limit,
      includeStats,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/admin/communities");

type CreateCommunityBody = Partial<
  Pick<
    NewCommunity,
    | "name"
    | "imageUrl"
    | "joinCode"
    | "address"
    | "city"
    | "state"
    | "zip"
    | "latitude"
    | "longitude"
    | "isActive"
    | "networkId"
  >
>;

/**
 * POST /api/admin/communities
 * Create a community. Body: Partial<Community> (name required).
 * Requires admin authentication.
 */
async function postHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const body = (await parseFormData(request)) as CreateCommunityBody;

    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const community = await communityDAL.createCommunity({
      name: body.name,
      imageUrl: body.imageUrl,
      joinCode: body.joinCode ?? null,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      latitude: body.latitude,
      longitude: body.longitude,
      isActive: body.isActive ?? true,
      networkId: body.networkId ?? null,
    } as Omit<NewCommunity, "id" | "createdAt" | "updatedAt">);

    return NextResponse.json(community, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/communities",
);

import { NextRequest, NextResponse } from "next/server";
import { messagesDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const archived = searchParams.get("archived") === "true";
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { data, error } = await tryCatch(
      messagesDAL.getUserConversationsPaginated(
        userId,
        archived,
        offset,
        limit,
      ),
    );

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch conversations" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

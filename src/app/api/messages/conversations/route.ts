import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { messagesDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";

const startConversationSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
  listingId: z.string().min(1, "Listing ID is required"),
  listingName: z.string().min(1, "Listing name is required"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message must be less than 5000 characters"),
});

/**
 * GET /api/messages/conversations
 * Get user's conversations (paginated)
 */
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

/**
 * POST /api/messages/conversations
 * Start a new conversation with a user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const body = await parseFormData(request);
    const validated = startConversationSchema.parse(body);

    const { data, error } = await tryCatch(
      messagesDAL.sendMessageToUser(
        userId,
        validated.recipientId,
        validated.message,
        validated.listingId,
      ),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
      conversationId: data.conversationId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

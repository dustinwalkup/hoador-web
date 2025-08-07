import { NextRequest } from "next/server";
import { messagesDAL } from "@/lib/dal";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const archived = searchParams.get("archived") === "true";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const conversations = await messagesDAL.getUserConversationsPaginated(
      archived,
      offset,
      limit,
    );
    return Response.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return Response.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}

import { NextRequest } from "next/server";
import { messagesDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const archived = searchParams.get("archived") === "true";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = parseInt(searchParams.get("limit") || "20");

  const { data, error } = await tryCatch(
    (async () => {
      return await messagesDAL.getUserConversationsPaginated(
        archived,
        offset,
        limit,
      );
    })(),
  );

  if (error) {
    console.error("Error fetching conversations:", error);
    return Response.json(
      { error: error.message || "Failed to fetch conversations" },
      { status: 500 },
    );
  }

  return Response.json(data);
}

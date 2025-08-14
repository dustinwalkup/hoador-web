import { NextRequest } from "next/server";
import { messagesDAL } from "@/lib/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  const { data, error } = await tryCatch(
    (async () => {
      return await messagesDAL.getConversationDetails(conversationId);
    })(),
  );

  if (error) {
    console.error("Error fetching conversation details:", error);
    return Response.json(
      { error: error.message || "Failed to fetch conversation details" },
      { status: 500 },
    );
  }

  return Response.json(data);
}

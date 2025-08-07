import { NextRequest, NextResponse } from "next/server";
import { messagesDAL } from "@/lib/dal";

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const conversationDetails = await messagesDAL.getConversationDetails(params.conversationId);
    
    return NextResponse.json(conversationDetails);
  } catch (error) {
    console.error("Error fetching conversation details:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation details" },
      { status: 500 }
    );
  }
} 
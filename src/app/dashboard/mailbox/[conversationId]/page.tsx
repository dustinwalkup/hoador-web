import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";

import { messagesDAL } from "@/lib/dal";
import { MessageInput } from "../_components/message-input";
import { ConversationHeader } from "../_components/conversation-header";

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  // Prevent caching to ensure fresh data
  unstable_noStore();

  const { conversationId } = await params;

  try {
    // Fetch conversation details and mark as read in parallel
    const [conversation] = await Promise.all([
      messagesDAL.getConversationDetails(conversationId),
      messagesDAL.markConversationAsRead(conversationId),
    ]);

    const formatTime = (date: Date) => {
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (diffInHours < 48) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    };

    return (
      <div className="flex flex-1 flex-col">
        <ConversationHeader user={conversation.otherUser} />

        <div className="flex-1 overflow-y-auto p-4">
          {conversation.messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h3 className="mb-2 text-lg font-medium">No messages yet</h3>
                <p className="text-muted-foreground text-sm">
                  Start the conversation by sending a message
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === "me"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <p>{message.content}</p>
                    <div
                      className={`mt-1 text-right text-xs ${
                        message.sender === "me"
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground/80"
                      }`}
                    >
                      {formatTime(message.time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <MessageInput />
      </div>
    );
  } catch {
    // If conversation is not found or user doesn't have access, show not found
    notFound();
  }
}

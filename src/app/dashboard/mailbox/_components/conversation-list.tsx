"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConversationSummary } from "@/lib/dal/messages.dal";

interface ConversationListProps {
  conversations: ConversationSummary[];
}

export function ConversationList({ conversations }: ConversationListProps) {
  const pathname = usePathname();

  const formatTime = (date: Date | null) => {
    if (!date) return "";

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
    <div className="w-full max-w-xs border-r">
      <div className="flex items-center border-b p-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input placeholder="Search messages" className="pl-8" />
        </div>
      </div>

      <Tabs defaultValue="inbox" className="p-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="h-[calc(100%-6rem)] overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            No conversations yet
          </div>
        ) : (
          conversations.map((conversation) => {
            const isActive =
              pathname === `/dashboard/mailbox/${conversation.id}`;
            return (
              <Link
                key={conversation.id}
                href={`/dashboard/mailbox/${conversation.id}`}
                className={`hover:bg-muted/50 flex cursor-pointer gap-3 border-b p-3 ${
                  isActive ? "bg-muted/50" : ""
                }`}
              >
                <Avatar className="h-10 w-10">
                  {conversation.otherUser.avatar ? (
                    <AvatarImage
                      src={conversation.otherUser.avatar}
                      alt={conversation.otherUser.name}
                    />
                  ) : null}
                  <AvatarFallback>
                    {conversation.otherUser.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${conversation.unread ? "text-primary" : ""}`}
                    >
                      {conversation.otherUser.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p
                    className={`truncate text-sm ${
                      conversation.unread
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {conversation.lastMessage?.content || "No messages yet"}
                  </p>
                </div>
                {conversation.unread && (
                  <Badge className="ml-2 h-2 w-2 rounded-full p-0" />
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

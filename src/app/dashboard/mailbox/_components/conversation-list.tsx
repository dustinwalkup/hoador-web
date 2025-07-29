"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const conversations = [
  {
    id: "1",
    user: {
      name: "Emily K.",
      avatar: "/avatar-anna.png",
      initials: "EK",
    },
    lastMessage:
      "I'd like to borrow your drill set for the weekend if it's available.",
    time: "10:23 AM",
    unread: true,
  },
  {
    id: "2",
    user: {
      name: "John D.",
      avatar: "",
      initials: "JD",
    },
    lastMessage: "Thanks for returning the pressure washer on time!",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "3",
    user: {
      name: "Maria G.",
      avatar: "",
      initials: "MG",
    },
    lastMessage: "Don't forget to return the circular saw by Friday.",
    time: "May 22",
    unread: false,
  },
];

export function ConversationList() {
  const pathname = usePathname();

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
        {conversations.map((conversation) => {
          const isActive = pathname === `/dashboard/mailbox/${conversation.id}`;
          return (
            <Link
              key={conversation.id}
              href={`/dashboard/mailbox/${conversation.id}`}
              className={`hover:bg-muted/50 flex cursor-pointer gap-3 border-b p-3 ${
                isActive ? "bg-muted/50" : ""
              }`}
            >
              <Avatar className="h-10 w-10">
                {conversation.user.avatar ? (
                  <AvatarImage
                    src={conversation.user.avatar || "/placeholder.svg"}
                    alt={conversation.user.name}
                  />
                ) : null}
                <AvatarFallback>{conversation.user.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-medium ${conversation.unread ? "text-primary" : ""}`}
                  >
                    {conversation.user.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {conversation.time}
                  </span>
                </div>
                <p
                  className={`truncate text-sm ${
                    conversation.unread
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {conversation.lastMessage}
                </p>
              </div>
              {conversation.unread && (
                <Badge className="ml-2 h-2 w-2 rounded-full p-0" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

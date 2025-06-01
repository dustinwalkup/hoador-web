"use client";

import { useState } from "react";
import {
  Search,
  Send,
  Paperclip,
  MoreHorizontal,
  Star,
  Trash2,
  Archive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MailboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >("1");

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
      messages: [
        {
          id: "1",
          sender: "them",
          content:
            "Hi there! I noticed you have a drill set listed. I'd like to borrow it for the weekend if it's available.",
          time: "10:23 AM",
        },
        {
          id: "2",
          sender: "me",
          content:
            "Hi Emily! Yes, the drill set is available this weekend. When would you like to pick it up?",
          time: "10:45 AM",
        },
        {
          id: "3",
          sender: "them",
          content:
            "That's great! Would Saturday morning around 9 AM work for you?",
          time: "11:02 AM",
        },
      ],
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
      messages: [
        {
          id: "1",
          sender: "them",
          content: "Thanks for returning the pressure washer on time!",
          time: "Yesterday",
        },
      ],
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
      messages: [
        {
          id: "1",
          sender: "them",
          content: "Don't forget to return the circular saw by Friday.",
          time: "May 22",
        },
      ],
    },
  ];

  const selectedThread = conversations.find(
    (c) => c.id === selectedConversation,
  );

  return (
    <div className="container flex h-[calc(100vh-8rem)] flex-col py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mailbox</h1>
          <p className="text-muted-foreground">
            Communicate with tool owners and borrowers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9">
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
          <Button size="sm" className="h-9">
            <Send className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        {/* Conversation List */}
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
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`hover:bg-muted/50 flex cursor-pointer gap-3 border-b p-3 ${
                  selectedConversation === conversation.id ? "bg-muted/50" : ""
                }`}
                onClick={() => setSelectedConversation(conversation.id)}
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
              </div>
            ))}
          </div>
        </div>

        {/* Message Thread */}
        {selectedThread ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedThread.user.avatar ? (
                    <AvatarImage
                      src={selectedThread.user.avatar || "/placeholder.svg"}
                      alt={selectedThread.user.name}
                    />
                  ) : null}
                  <AvatarFallback>
                    {selectedThread.user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedThread.user.name}</div>
                  <div className="text-muted-foreground text-xs">
                    Last active: Today at 11:02 AM
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Star className="h-4 w-4" />
                  <span className="sr-only">Star</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                    <DropdownMenuItem>Block user</DropdownMenuItem>
                    <DropdownMenuItem>Report conversation</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                {selectedThread.messages.map((message) => (
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
                        {message.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <Input placeholder="Type your message..." className="flex-1" />
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach file</span>
                </Button>
                <Button size="icon" className="h-10 w-10">
                  <Send className="h-5 w-5" />
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium">
                Select a conversation
              </h3>
              <p className="text-muted-foreground text-sm">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

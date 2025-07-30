"use client";

import { MoreHorizontal, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationHeaderProps {
  user: {
    name: string;
    avatar?: string | null;
    initials: string;
  };
}

export function ConversationHeader({ user }: ConversationHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b p-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {user.avatar ? (
            <AvatarImage
              src={user.avatar || "/placeholder.svg"}
              alt={user.name}
            />
          ) : null}
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{user.name}</div>
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
  );
}

"use client";

import { Send, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MessageInput() {
  return (
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
  );
}

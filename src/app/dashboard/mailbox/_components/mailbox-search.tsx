"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MailboxSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MailboxSearch({
  searchQuery,
  onSearchChange,
}: MailboxSearchProps) {
  return (
    <div className="p-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <Input
          placeholder="Search messages"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}

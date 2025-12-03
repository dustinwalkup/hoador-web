"use client";

import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ReviewerAvatarProps {
  avatarUrl: string | null | undefined;
  name: string | null | undefined;
  reviewerId: string;
}

function ReviewerAvatarComponent({ avatarUrl, name }: ReviewerAvatarProps) {
  const hasAvatar = avatarUrl && avatarUrl.trim() !== "";

  return (
    <Avatar className="h-8 w-8">
      {hasAvatar && <AvatarImage src={avatarUrl!} alt={name || "Reviewer"} />}
      <AvatarFallback>
        {name
          ? name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
          : "U"}
      </AvatarFallback>
    </Avatar>
  );
}

// Memoize component to prevent unnecessary re-renders when props haven't changed
export const ReviewerAvatar = memo(
  ReviewerAvatarComponent,
  (prevProps, nextProps) => {
    // Only re-render if props actually changed
    return (
      prevProps.avatarUrl === nextProps.avatarUrl &&
      prevProps.name === nextProps.name
    );
  },
);

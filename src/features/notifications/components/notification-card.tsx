"use client";

import { CheckIcon, CircleIcon, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTimeAgo } from "../utils/get-time-ago";
import type { Notification } from "../hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notificationIcons: Record<string, string> = {
  rental_request_created: "📬",
  rental_approved: "✅",
  rental_denied: "❌",
  rental_started: "🎉",
  rental_ended: "🏁",
  rental_cancelled: "🚫",
  rental_overdue: "⚠️",
  rental_reminder: "⏰",
  payment_succeeded: "💰",
  payment_failed: "⚠️",
  payment_refunded: "↩️",
  review_received: "⭐",
  message_received: "💬",
  system: "🔔",
};

interface NotificationCardProps {
  notification: Notification;
  onNavigate?: (notificationId: string, linkUrl?: string) => void;
  onToggleRead?: (notificationId: string, currentReadStatus: boolean) => void;
  variant?: "dropdown" | "page";
}

export function NotificationCard({
  notification,
  onNavigate,
  onToggleRead,
  variant = "page",
}: NotificationCardProps) {
  const icon = notificationIcons[notification.type] || notificationIcons.system;
  const linkUrl = notification.data?.linkUrl as string | undefined;
  const timeAgo = getTimeAgo(new Date(notification.createdAt));

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate(notification.id, linkUrl);
    }
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when toggling read status
    if (onToggleRead) {
      onToggleRead(notification.id, notification.isRead);
    }
  };

  const content = (
    <>
      <span className={variant === "dropdown" ? "text-lg" : "text-2xl"}>
        {icon}
      </span>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "leading-none font-medium",
              variant === "dropdown" ? "text-sm" : "",
            )}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-1">
            {!notification.isRead && (
              <div className="bg-primary h-2 w-2 shrink-0 rounded-full" />
            )}
            {onToggleRead && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Notification options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRead(e);
                    }}
                  >
                    {notification.isRead ? (
                      <>
                        <CircleIcon className="mr-2 h-4 w-4" />
                        Mark as unread
                      </>
                    ) : (
                      <>
                        <CheckIcon className="mr-2 h-4 w-4" />
                        Mark as read
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <p
          className={cn(
            "text-muted-foreground",
            variant === "dropdown" ? "line-clamp-2 text-xs" : "text-sm",
          )}
        >
          {notification.message}
        </p>
        <p className="text-muted-foreground text-xs">{timeAgo}</p>
      </div>
    </>
  );

  if (variant === "dropdown") {
    return (
      <div
        className={cn(
          "group flex w-full cursor-pointer items-start gap-2 p-3",
          !notification.isRead && "bg-muted/50",
        )}
        onClick={handleCardClick}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group hover:bg-muted/50 w-full cursor-pointer rounded-lg border p-4 transition-colors",
        !notification.isRead && "border-primary/50 bg-muted/30",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">{content}</div>
    </div>
  );
}

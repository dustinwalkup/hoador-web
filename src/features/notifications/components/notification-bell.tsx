"use client";

import { BellIcon, CheckIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
} from "../hooks/use-notifications";

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

// Helper function to get the time ago string
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  const weeks = Math.floor(seconds / 604800);
  return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount, isLoading: isLoadingCount } = useUnreadCount();
  const {
    data: notificationsData,
    isLoading,
    error,
  } = useNotifications({ limit: 10 });
  const markAsRead = useMarkAsRead();

  const notifications = notificationsData?.data || [];
  const hasUnread = (unreadCount ?? 0) > 0;

  const handleNotificationClick = async (
    notificationId: string,
    linkUrl?: string,
  ) => {
    // Mark as read
    await markAsRead.mutateAsync({ notificationId });

    // Navigate to link if provided
    if (linkUrl) {
      router.push(linkUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAsRead.mutateAsync({ markAll: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8" size="icon">
          <BellIcon className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
          {hasUnread && !isLoadingCount && (
            <span className="bg-destructive text-primary-foreground absolute -top-1 -right-1 flex size-2 items-center justify-center rounded-full p-2 text-xs">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={markAsRead.isPending}
            >
              <CheckIcon className="mr-1 h-3 w-3" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Failed to load notifications
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <BellIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => {
              const icon =
                notificationIcons[notification.type] ||
                notificationIcons.system;
              const linkUrl = notification.data?.linkUrl as string | undefined;
              const timeAgo = getTimeAgo(new Date(notification.createdAt));

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "cursor-pointer flex-col items-start gap-1 p-3",
                    !notification.isRead && "bg-muted/50",
                  )}
                  onClick={() =>
                    handleNotificationClick(notification.id, linkUrl)
                  }
                >
                  <div className="flex w-full items-start gap-2">
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm leading-none font-medium">
                        {notification.title}
                      </p>
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {notification.message}
                      </p>
                      <p className="text-muted-foreground text-xs">{timeAgo}</p>
                    </div>
                    {!notification.isRead && (
                      <div className="bg-primary h-2 w-2 rounded-full" />
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

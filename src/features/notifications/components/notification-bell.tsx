"use client";

import { BellIcon, CheckIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
  useToggleReadStatus,
} from "../hooks/use-notifications";
import { NotificationCard } from "./notification-card";

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount, isLoading: isLoadingCount } = useUnreadCount();
  const {
    data: notificationsData,
    isLoading,
    error,
  } = useNotifications({ limit: 10 });
  const markAsRead = useMarkAsRead();
  const toggleReadStatus = useToggleReadStatus();

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

  const handleToggleRead = async (
    notificationId: string,
    currentReadStatus: boolean,
  ) => {
    await toggleReadStatus.mutateAsync({ notificationId, currentReadStatus });
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
          <>
            <ScrollArea className="h-[400px]">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="cursor-pointer p-0"
                  onSelect={(e) => e.preventDefault()}
                >
                  <NotificationCard
                    notification={notification}
                    onNavigate={handleNotificationClick}
                    onToggleRead={handleToggleRead}
                    variant="dropdown"
                  />
                </DropdownMenuItem>
              ))}
            </ScrollArea>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer justify-center"
              onClick={() => router.push("/dashboard/notifications")}
            >
              <span className="font-medium">
                View All Notifications
                {notificationsData?.pagination?.total &&
                  notificationsData.pagination.total > 10 &&
                  ` (${notificationsData.pagination.total})`}
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

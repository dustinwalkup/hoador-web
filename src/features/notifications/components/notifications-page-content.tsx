"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, CheckIcon, FilterIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInfiniteNotifications,
  useMarkAsRead,
  useToggleReadStatus,
} from "../hooks/use-notifications";
import { NotificationCard } from "./notification-card";

const notificationTypeLabels: Record<string, string> = {
  rental_request_created: "Rental Requests",
  rental_approved: "Approvals",
  rental_denied: "Denials",
  rental_started: "Started Rentals",
  rental_ended: "Ended Rentals",
  rental_cancelled: "Cancellations",
  rental_overdue: "Overdue",
  rental_reminder: "Reminders",
  payment_succeeded: "Payments",
  payment_failed: "Failed Payments",
  payment_refunded: "Refunds",
  review_received: "Reviews",
  message_received: "Messages",
  system: "System",
};

export function NotificationsPageContent() {
  const router = useRouter();
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteNotifications({
    limit: 20,
    isRead: readFilter === "all" ? undefined : readFilter === "read",
    type: typeFilter === "all" ? undefined : typeFilter,
  });

  const markAsRead = useMarkAsRead();
  const toggleReadStatus = useToggleReadStatus();

  // Flatten all pages into a single array
  const allNotifications = useMemo(() => {
    return data?.pages?.flatMap((page) => page.data) || [];
  }, [data]);

  const hasUnread = allNotifications.some((n) => !n.isRead);

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
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with your rental activities"
      >
        {hasUnread && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAsRead.isPending}
          >
            <CheckIcon className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Tabs
          value={readFilter}
          onValueChange={(value) => setReadFilter(value as typeof readFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <FilterIcon className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(notificationTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BellIcon className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            Failed to load notifications
          </h3>
          <p className="text-sm text-gray-600">{error.message}</p>
        </div>
      ) : allNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BellIcon className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            No notifications
          </h3>
          <p className="text-sm text-gray-600">
            {readFilter === "unread"
              ? "You're all caught up!"
              : typeFilter !== "all"
                ? "No notifications of this type"
                : "You don't have any notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allNotifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onNavigate={handleNotificationClick}
              onToggleRead={handleToggleRead}
              variant="page"
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

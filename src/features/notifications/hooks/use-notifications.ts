"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationsResponse {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Fetch paginated notifications for the current user
 */
export function useNotifications(
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {},
) {
  const { page = 1, limit = 20, unreadOnly = false } = options;

  return useQuery({
    queryKey: ["notifications", { page, limit, unreadOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString(),
      });

      const response = await fetch(`/api/notifications?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch notifications");
      }

      return response.json() as Promise<NotificationsResponse>;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}

/**
 * Fetch unread notification count for the current user
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/count");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch unread count");
      }

      const data = await response.json();
      return data.count as number;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
}

/**
 * Fetch infinite scrolling notifications with filters
 */
export function useInfiniteNotifications(
  options: {
    limit?: number;
    isRead?: boolean;
    type?: string;
  } = {},
) {
  const { limit = 20, isRead, type } = options;

  return useInfiniteQuery({
    queryKey: ["notifications", "infinite", { limit, isRead, type }],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam.toString(),
        limit: limit.toString(),
      });

      if (isRead !== undefined) {
        params.set("isRead", isRead.toString());
      }

      if (type) {
        params.set("type", type);
      }

      const response = await fetch(`/api/notifications?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch notifications");
      }

      return response.json() as Promise<NotificationsResponse>;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNext
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Mark notification(s) as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: {
      notificationId?: string;
      markAll?: boolean;
    }) => {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark as read");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate notifications and unread count queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Toggle notification read/unread status
 */
export function useToggleReadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: {
      notificationId: string;
      currentReadStatus: boolean;
    }) => {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationId: options.notificationId,
          toggleRead: true,
          currentReadStatus: options.currentReadStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to toggle read status");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate notifications and unread count queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

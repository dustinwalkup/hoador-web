"use client";

import { useQuery } from "@tanstack/react-query";

export interface BadgeNotification {
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

export interface DashboardBadges {
  unreadMessages: number;
  unreadNotifications: number;
  notifications: {
    data: BadgeNotification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export const DASHBOARD_BADGES_QUERY_KEY = ["dashboard", "badges"] as const;

/**
 * Single poll that feeds every authenticated-nav badge on the dashboard:
 * unread message count (sidebar), unread notification count (bell), and the
 * latest 10 notifications (bell dropdown). Replaces three independent 30s
 * pollers; mutations that used to invalidate each legacy key now also
 * invalidate ["dashboard", "badges"].
 */
export function useDashboardBadges() {
  return useQuery({
    queryKey: DASHBOARD_BADGES_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/dashboard/badges");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch dashboard badges");
      }
      return response.json() as Promise<DashboardBadges>;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

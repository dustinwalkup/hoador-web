"use client";

import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { CategoryPreferencesResult } from "@/features/notifications/lib/preference-service";

export const notificationPreferencesKeys = {
  all: ["notification-preferences"] as const,
};

interface PatchPreferencesBody {
  master?: { email?: boolean; push?: boolean };
  categories?: Record<string, { email?: boolean; push?: boolean }>;
}

/**
 * Fetch notification preferences (master + per-category) for the current user.
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferencesKeys.all,
    queryFn: async (): Promise<CategoryPreferencesResult> => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load preferences");
      }
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Patch notification preferences (master toggles and/or per-category toggles).
 */
export function useUpdateNotificationPreferences() {
  return useCreateMutation<CategoryPreferencesResult, PatchPreferencesBody>({
    mutationFn: async (body) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update preferences");
      }
      return res.json();
    },
    successMessage: "Preferences updated",
    invalidateQueryKeys: [notificationPreferencesKeys.all],
  });
}

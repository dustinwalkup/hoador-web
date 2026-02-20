"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks/use-notification-preferences";
import type { NotificationCategory } from "@/features/notifications/lib/notification-type-map";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  bookings: "Bookings",
  payments: "Payments",
  messages: "Messages",
  disputes: "Disputes",
  reminders: "Reminders",
};

export function PreferencesTab() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const patchMutation = useUpdateNotificationPreferences();

  const updateMaster = (field: "email" | "push", value: boolean) => {
    if (!preferences) return;
    patchMutation.mutate({ master: { [field]: value } });
  };

  const updateCategory = (
    category: NotificationCategory,
    field: "email" | "push",
    value: boolean,
  ) => {
    const current = preferences?.categories?.[category] ?? {
      email: true,
      push: true,
    };
    patchMutation.mutate({
      categories: {
        [category]: { ...current, [field]: value },
      },
    });
  };

  return (
    <div className=" ">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Manage how you receive notifications (email and push per category)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <PreferencesSkeleton />
          ) : preferences ? (
            <>
              <div className="flex flex-row gap-3 sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-muted-foreground text-sm">
                    Master switch for email; category toggles below
                  </p>
                </div>
                <Switch
                  checked={preferences.master.email}
                  onCheckedChange={(v) => updateMaster("email", v)}
                  disabled={patchMutation.isPending}
                />
              </div>
              <div className="flex gap-3 sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-muted-foreground text-sm">
                    Master switch for push; category toggles below
                  </p>
                </div>
                <Switch
                  checked={preferences.master.push}
                  onCheckedChange={(v) => updateMaster("push", v)}
                  disabled={patchMutation.isPending}
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="mb-3 font-medium">By category</h4>
                <div className="space-y-4">
                  {(
                    Object.entries(preferences.categories) as [
                      NotificationCategory,
                      { email: boolean; push: boolean },
                    ][]
                  ).map(([category, { email, push }]) => (
                    <div
                      key={category}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <span className="font-medium">
                        {CATEGORY_LABELS[category]}
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`${category}-email`}
                            className="text-muted-foreground text-sm"
                          >
                            Email
                          </Label>
                          <Switch
                            id={`${category}-email`}
                            checked={email}
                            onCheckedChange={(v) =>
                              updateCategory(category, "email", v)
                            }
                            disabled={patchMutation.isPending}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`${category}-push`}
                            className="text-muted-foreground text-sm"
                          >
                            Push
                          </Label>
                          <Switch
                            id={`${category}-push`}
                            checked={push}
                            onCheckedChange={(v) =>
                              updateCategory(category, "push", v)
                            }
                            disabled={patchMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Unable to load preferences.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MasterSwitchSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
}

function CategoryRowSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
      <Skeleton className="h-5 w-24" />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function PreferencesSkeleton() {
  return (
    <div className="space-y-4">
      <MasterSwitchSkeleton />
      <MasterSwitchSkeleton />
      <div className="border-t pt-4">
        <Skeleton className="mb-3 h-5 w-24" />
        <div className="space-y-4">
          {Array.from({ length: Object.keys(CATEGORY_LABELS).length }).map(
            (_, i) => (
              <CategoryRowSkeleton key={i} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useVisibility,
  useUpdateVisibility,
  type VisibilityUpdate,
} from "@/features/users/hooks/use-visibility";

/**
 * Profile-page card: choose which communities the current user appears in.
 * The home (primary) community is locked visible — both here and in the DAL.
 */
export function VisibilitySettingsCard() {
  const { data: rows, isLoading, isError } = useVisibility();
  const updateMutation = useUpdateVisibility();

  // Only the toggles the user has explicitly flipped; merged with the server
  // rows at render time so there's no effect syncing local state to props.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const diff = useMemo<VisibilityUpdate[]>(() => {
    if (!rows) return [];
    return rows
      .filter(
        (r) =>
          r.community.id in overrides &&
          overrides[r.community.id] !== r.isVisible,
      )
      .map((r) => ({
        communityId: r.community.id,
        isVisible: overrides[r.community.id],
      }));
  }, [rows, overrides]);

  const toggle = (communityId: string, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [communityId]: value }));
  };

  const handleSave = () => {
    if (diff.length === 0) return;
    updateMutation.mutate(diff, { onSuccess: () => setOverrides({}) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Visibility</CardTitle>
        <CardDescription>
          Choose which communities you appear in. Turning one off hides your
          listings from that community and hides that community&apos;s listings
          from you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-9" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t load your visibility settings. Please refresh and
              try again.
            </AlertDescription>
          </Alert>
        ) : rows && rows.length > 0 ? (
          <>
            <div className="divide-y">
              {rows.map((row) => {
                const checked = overrides[row.community.id] ?? row.isVisible;
                return (
                  <div
                    key={row.community.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{row.community.name}</p>
                      {row.isPrimary && (
                        <p className="text-muted-foreground text-xs">
                          Home community — always visible
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={row.isPrimary ? true : checked}
                      disabled={row.isPrimary || updateMutation.isPending}
                      onCheckedChange={(v) => toggle(row.community.id, v)}
                      aria-label={`Visible in ${row.community.name}`}
                    />
                  </div>
                );
              })}
            </div>
            {updateMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : "Failed to update visibility"}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={diff.length === 0 || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            You&apos;re not part of a community network yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

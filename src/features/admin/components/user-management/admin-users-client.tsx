"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users";
import { useQueryClient } from "@tanstack/react-query";
import { BulkActionToolbar } from "./bulk-action-toolbar";
import type { UserStatus, UserType } from "@/dal/types";

const STATUS_OPTIONS: { value: "" | UserStatus; label: string }[] = [
  { value: "", label: "All status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "email_verified", label: "Email verified" },
  { value: "incomplete_profile", label: "Incomplete profile" },
];

const TYPE_OPTIONS: { value: "" | UserType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "standard", label: "Standard" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

const DEBOUNCE_MS = 300;

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Relative time (e.g. "3 days ago") and color class for last active. */
function lastActiveDisplay(lastActiveAt: Date | null | string): {
  text: string;
  className: string;
} {
  if (lastActiveAt == null) {
    return { text: "Never", className: "text-muted-foreground" };
  }
  const date =
    typeof lastActiveAt === "string" ? new Date(lastActiveAt) : lastActiveAt;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  let text: string;
  if (diffDays < 1) {
    const diffMins = Math.floor(diffMs / (60 * 1000));
    text =
      diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins / 60)}h ago`;
  } else if (diffDays < 30) {
    text = `${diffDays}d ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    text = `${months}mo ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    text = `${years}y ago`;
  }

  let className: string;
  if (diffDays < 7) className = "text-emerald-600 dark:text-emerald-400";
  else if (diffDays < 30) className = "text-amber-600 dark:text-amber-400";
  else if (diffDays < 90) className = "text-orange-600 dark:text-orange-400";
  else className = "text-red-600 dark:text-red-400";

  return { text, className };
}

const INACTIVE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any activity" },
  { value: "7", label: "Inactive 7+ days" },
  { value: "14", label: "Inactive 14+ days" },
  { value: "30", label: "Inactive 30+ days" },
  { value: "60", label: "Inactive 60+ days" },
  { value: "90", label: "Inactive 90+ days" },
];

const SORT_OPTIONS: { value: "createdAt" | "lastActiveAt"; label: string }[] = [
  { value: "createdAt", label: "Recently signed up" },
  { value: "lastActiveAt", label: "Last active" },
];

export function AdminUsersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1");
  const statusParam = searchParams.get("status") || "";
  const userTypeParam = searchParams.get("userType") || "";
  const searchParam = searchParams.get("search") ?? "";
  const inactiveDaysParam = searchParams.get("inactiveDays") ?? "";
  const sortByParam = searchParams.get("sortBy") || "";

  const [searchInput, setSearchInput] = useState(searchParam);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const status = (statusParam as UserStatus) || undefined;
  const userType = (userTypeParam as UserType) || undefined;
  const search = searchParam || undefined;
  const inactiveDays =
    inactiveDaysParam === "" ? undefined : parseInt(inactiveDaysParam, 10);
  const sortBy = sortByParam === "lastActiveAt" ? "lastActiveAt" : "createdAt";

  const { data, isLoading, error } = useAdminUsers({
    search,
    status,
    userType,
    page,
    limit: 20,
    inactiveDays:
      inactiveDays != null && !Number.isNaN(inactiveDays)
        ? inactiveDays
        : undefined,
    sortBy,
  });

  const updateUrl = useCallback(
    (updates: {
      search?: string;
      status?: string;
      userType?: string;
      page?: number;
      inactiveDays?: number | "";
      sortBy?: "createdAt" | "lastActiveAt";
    }) => {
      const params = new URLSearchParams(searchParams);
      if (updates.search !== undefined) {
        if (updates.search === "") params.delete("search");
        else params.set("search", updates.search);
      }
      if (updates.status !== undefined) {
        if (updates.status === "") params.delete("status");
        else params.set("status", updates.status);
      }
      if (updates.userType !== undefined) {
        if (updates.userType === "") params.delete("userType");
        else params.set("userType", updates.userType);
      }
      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", String(updates.page));
      }
      if (updates.inactiveDays !== undefined) {
        if (updates.inactiveDays === "") params.delete("inactiveDays");
        else params.set("inactiveDays", String(updates.inactiveDays));
      }
      if (updates.sortBy !== undefined) {
        if (updates.sortBy === "createdAt") params.delete("sortBy");
        else params.set("sortBy", updates.sortBy);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== searchParam) {
        updateUrl({ search: searchInput || "", page: 1 });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, searchParam, updateUrl]);

  const handleStatusChange = useCallback(
    (value: string) => {
      updateUrl({ status: value, page: 1 });
    },
    [updateUrl],
  );

  const handleUserTypeChange = useCallback(
    (value: string) => {
      updateUrl({ userType: value, page: 1 });
    },
    [updateUrl],
  );

  const handleInactiveDaysChange = useCallback(
    (value: string) => {
      const num = value === "" ? "" : parseInt(value, 10);
      updateUrl({
        inactiveDays: num === "" || Number.isNaN(num) ? "" : num,
        page: 1,
      });
    },
    [updateUrl],
  );

  const handleSortByChange = useCallback(
    (value: string) => {
      updateUrl({
        sortBy: value === "lastActiveAt" ? "lastActiveAt" : "createdAt",
        page: 1,
      });
    },
    [updateUrl],
  );

  const toggleUser = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    if (!data?.data.length) return;
    const ids = data.data.map((u) => u.id);
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [data?.data]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkStatusChange = useCallback(
    async (userIds: string[], status: UserStatus) => {
      const response = await fetch("/api/admin/users/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          userIds,
          payload: { status },
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Bulk update failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    [queryClient],
  );

  const bulkReengagement = useCallback(
    async (
      userIds: string[],
      message: string,
      channels: { email: boolean; push: boolean },
    ) => {
      const response = await fetch("/api/admin/users/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_reengagement",
          userIds,
          payload: { message, channels },
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Re-engagement send failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    [queryClient],
  );

  const pagination = data?.pagination;
  const hasPrev = pagination?.hasPrev ?? false;
  const hasNext = pagination?.hasNext ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          {search || status || userType || inactiveDays
            ? "Filtered results. Clear filters to see recently signed up users."
            : "Recently signed up users. Use search or filters to narrow down."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search users by name or email..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={statusParam || "all"}
            onValueChange={(v) => handleStatusChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={userTypeParam || "all"}
            onValueChange={(v) => handleUserTypeChange(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPE_OPTIONS.filter((o) => o.value).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={inactiveDaysParam || "any"}
            onValueChange={(v) =>
              handleInactiveDaysChange(v === "any" ? "" : v)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Activity" />
            </SelectTrigger>
            <SelectContent>
              {INACTIVE_OPTIONS.map((o) => (
                <SelectItem key={o.value || "any"} value={o.value || "any"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortByParam || "createdAt"}
            onValueChange={(v) =>
              handleSortByChange(v === "createdAt" ? "createdAt" : v)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load users</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <BulkActionToolbar
              selectedIds={selectedIds}
              onClearSelection={clearSelection}
              onBulkStatusChange={bulkStatusChange}
              onBulkReengagement={bulkReengagement}
            />
            {selectedIds.size > 0 && <div className="mb-3" />}
            <div className="space-y-2">
              {data.data.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  No users match your filters.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border px-4 py-2">
                    <Checkbox
                      checked={
                        data.data.length > 0 &&
                        data.data.every((u) => selectedIds.has(u.id))
                      }
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                    <span className="text-muted-foreground text-sm">
                      Select all on page
                    </span>
                  </div>
                  {data.data.map((u) => {
                    const lastActive = lastActiveDisplay(u.lastActiveAt);
                    return (
                      <div
                        key={u.id}
                        className="flex flex-nowrap items-center justify-between gap-4 rounded-lg border p-4"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <Checkbox
                            checked={selectedIds.has(u.id)}
                            onCheckedChange={() => toggleUser(u.id)}
                            aria-label={`Select ${u.name}`}
                          />
                          <Users className="text-muted-foreground h-5 w-5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium break-words">
                              {u.name}
                            </h3>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="break-all">{u.email}</span>
                              <span>•</span>
                              <span>Joined: {formatDate(u.createdAt)}</span>
                              <span>•</span>
                              <span
                                className={lastActive.className}
                                title={
                                  u.lastActiveAt
                                    ? formatDate(u.lastActiveAt)
                                    : "No activity recorded"
                                }
                              >
                                Last active: {lastActive.text}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-nowrap items-center gap-3">
                          <Badge
                            variant={
                              u.status === "active"
                                ? "default"
                                : u.status === "suspended"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="whitespace-normal"
                          >
                            {u.status.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="whitespace-normal"
                          >
                            {u.userType}
                          </Badge>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/dashboard/user/${u.id}`}>
                              View
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {pagination && data.data.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  Page {pagination.page} of {pagination.totalPages} (
                  {pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => updateUrl({ page: page - 1 })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => updateUrl({ page: page + 1 })}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

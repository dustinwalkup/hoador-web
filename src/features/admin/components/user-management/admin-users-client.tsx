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
import {
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAdminUsers } from "@/features/admin/hooks/use-admin-users";
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

export function AdminUsersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1");
  const statusParam = searchParams.get("status") || "";
  const userTypeParam = searchParams.get("userType") || "";
  const searchParam = searchParams.get("search") ?? "";

  const [searchInput, setSearchInput] = useState(searchParam);

  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const status = (statusParam as UserStatus) || undefined;
  const userType = (userTypeParam as UserType) || undefined;
  const search = searchParam || undefined;

  const { data, isLoading, error } = useAdminUsers({
    search,
    status,
    userType,
    page,
    limit: 20,
  });

  const updateUrl = useCallback(
    (updates: {
      search?: string;
      status?: string;
      userType?: string;
      page?: number;
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

  const pagination = data?.pagination;
  const hasPrev = pagination?.hasPrev ?? false;
  const hasNext = pagination?.hasNext ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          {search || status || userType
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
            <div className="space-y-2">
              {data.data.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  No users match your filters.
                </div>
              ) : (
                data.data.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      <Users className="text-muted-foreground h-5 w-5 shrink-0" />
                      <div>
                        <h3 className="font-medium">{u.name}</h3>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span>{u.email}</span>
                          <span>•</span>
                          <span>Joined: {formatDate(u.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant={
                          u.status === "active"
                            ? "default"
                            : u.status === "suspended"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {u.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline">{u.userType}</Badge>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/dashboard/user/${u.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))
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

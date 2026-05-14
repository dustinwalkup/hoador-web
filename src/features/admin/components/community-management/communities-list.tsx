"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminCommunities } from "@/features/admin/hooks/use-admin-communities";
import type {
  Community,
  CommunityWithStats,
} from "@/db/schemas/communities.schema";
import { CommunityEditForm } from "./community-edit-form";

const PAGE_SIZE = 25;

type ListCommunity = Community | CommunityWithStats;

function hasStats(c: ListCommunity): c is CommunityWithStats {
  return "memberCount" in c;
}

/**
 * Admin community CRUD list — table of communities with create / edit actions.
 * Edit and create open the {@link CommunityEditForm} in a dialog.
 */
export function CommunitiesList() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ListCommunity | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useAdminCommunities({
    page,
    limit: PAGE_SIZE,
    includeStats: true,
  });

  const communities = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Communities</CardTitle>
          <CardDescription>
            Manage communities and their network assignment.
          </CardDescription>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New community
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load communities</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : communities.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No communities yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Location</th>
                    <th className="py-2 pr-4 font-medium">Members</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {communities.map((community) => (
                    <tr key={community.id} className="border-b">
                      <td className="py-3 pr-4 font-medium">
                        {community.name}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4">
                        {[community.city, community.state]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="text-muted-foreground py-3 pr-4">
                        {hasStats(community) ? community.memberCount : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={community.isActive ? "secondary" : "outline"}
                        >
                          {community.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(community)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!open) setCreating(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New community</DialogTitle>
          </DialogHeader>
          <CommunityEditForm
            onSaved={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit community</DialogTitle>
          </DialogHeader>
          {editing && (
            <CommunityEditForm
              community={editing}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

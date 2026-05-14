"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminPendingVerifications,
  useVerifyMembership,
  useDenyMembership,
} from "@/features/admin/hooks/use-admin-mutations";
import type { MembershipWithUserAndAddress } from "@/db/schemas/communities.schema";

function formatAddress(
  address: MembershipWithUserAndAddress["address"],
): string {
  if (!address) return "No address on file";
  return [address.street, address.city, address.state, address.zipCode]
    .filter(Boolean)
    .join(", ");
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DenyDialog({
  row,
  open,
  onOpenChange,
}: {
  row: MembershipWithUserAndAddress | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState("");
  const denyMutation = useDenyMembership();

  const handleConfirm = async () => {
    if (!row || notes.trim().length === 0) return;
    try {
      await denyMutation.mutateAsync({
        membershipId: row.membership.id,
        adminNotes: notes.trim(),
      });
      setNotes("");
      onOpenChange(false);
    } catch {
      // Error surfaced via toast.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNotes("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deny residency claim</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.user.firstName ?? ""} ${row.user.lastName ?? ""} → ${row.community.name}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="deny-notes">Reason (required)</Label>
          <Textarea
            id="deny-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why this claim is being denied. The user can re-submit."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={notes.trim().length === 0 || denyMutation.isPending}
          >
            {denyMutation.isPending ? "Denying…" : "Deny"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ITEMS_PER_PAGE = 25;

export function PendingVerificationsTab() {
  const [page, setPage] = useState(1);
  const [denyRow, setDenyRow] = useState<MembershipWithUserAndAddress | null>(
    null,
  );

  const { data, isLoading, error } = useAdminPendingVerifications({
    page,
    limit: ITEMS_PER_PAGE,
  });
  const verifyMutation = useVerifyMembership();

  const rows = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Verifications</CardTitle>
        <CardDescription>
          Residency claims awaiting manual verification. Verifying is a trust
          signal — pending users already have full marketplace access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-destructive py-12 text-center">
            <p>Failed to load pending verifications</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Nothing to verify right now. 🎉
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-left">
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-medium">User</th>
                    <th className="py-2 pr-4 font-medium">Submitted address</th>
                    <th className="py-2 pr-4 font-medium">Community</th>
                    <th className="py-2 pr-4 font-medium">Submitted</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.membership.id} className="border-b">
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {row.user.firstName} {row.user.lastName}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {row.user.email}
                        </div>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4">
                        {formatAddress(row.address)}
                      </td>
                      <td className="py-3 pr-4">{row.community.name}</td>
                      <td className="text-muted-foreground py-3 pr-4">
                        {formatDate(row.membership.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              verifyMutation.mutate({
                                membershipId: row.membership.id,
                              })
                            }
                            disabled={verifyMutation.isPending}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDenyRow(row)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Deny
                          </Button>
                        </div>
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

      <DenyDialog
        row={denyRow}
        open={denyRow !== null}
        onOpenChange={(open) => {
          if (!open) setDenyRow(null);
        }}
      />
    </Card>
  );
}

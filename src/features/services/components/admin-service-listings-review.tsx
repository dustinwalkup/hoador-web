"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceListingWithCategoryAndProvider } from "@/dal/service-listing.dal";
import { formatServiceUsd } from "@/features/services/lib/service-labels";

interface AdminServiceListingsReviewProps {
  listings: ServiceListingWithCategoryAndProvider[];
}

/**
 * Approve / reject pending HOA service listings (admin).
 */
export function AdminServiceListingsReview({
  listings,
}: AdminServiceListingsReviewProps) {
  const router = useRouter();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function approve() {
    if (!approveId) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/services/listings/${approveId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() || undefined }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Approve failed");
        return;
      }
      toast.success("Listing approved.");
      setApproveId(null);
      setNote("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function reject() {
    if (!rejectId) return;
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/services/listings/${rejectId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Reject failed");
        return;
      }
      toast.success("Listing rejected.");
      setRejectId(null);
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (listings.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        No listings pending review
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {listings.map((listing) => {
          const providerName =
            [listing.provider.firstName, listing.provider.lastName]
              .filter(Boolean)
              .join(" ") || listing.provider.email;
          const submitted =
            listing.createdAt instanceof Date
              ? listing.createdAt.toLocaleString()
              : String(listing.createdAt);
          return (
            <div
              key={listing.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{listing.title}</p>
                <p className="text-muted-foreground text-sm">{providerName}</p>
                <p className="text-muted-foreground text-sm">
                  {listing.category.name} ·{" "}
                  {listing.pricingType === "hourly"
                    ? `${formatServiceUsd(listing.price)}/hr`
                    : formatServiceUsd(listing.price)}{" "}
                  · Submitted {submitted}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setApproveId(listing.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectId(listing.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!approveId} onOpenChange={() => setApproveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve listing</DialogTitle>
          </DialogHeader>
          <Label htmlFor="note">Internal note (optional)</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>
              Cancel
            </Button>
            <Button onClick={approve} disabled={pending}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject listing</DialogTitle>
          </DialogHeader>
          <Label htmlFor="reason">Reason (required)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

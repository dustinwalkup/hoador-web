"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { usePaymentLifecycleDetail } from "@/features/admin/hooks/use-payment-lifecycle";
import {
  useResetPayoutStatus,
  useResetTransferStatus,
  useReleaseDeposit,
} from "@/features/admin/hooks/use-payment-lifecycle-mutations";

function statusVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (["failed", "expired", "release_failed"].includes(s)) return "destructive";
  if (["processing", "frozen", "scheduled", "held"].includes(s))
    return "secondary";
  if (["completed", "released", "captured"].includes(s)) return "default";
  return "outline";
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Timeline event for payment lifecycle (Phase 4 — Requirement 36.2). */
interface TimelineEvent {
  key: string;
  label: string;
  timestamp: Date | null;
  amount?: string;
  stripeId?: string;
  description?: string;
  disputeId?: string;
}

function buildPaymentTimeline(data: {
  lifecycle: {
    rentalChargeId: string | null;
    depositHoldStatus: string;
    depositHoldPlacedAt: Date | null;
    depositReleasedAt: Date | null;
    depositCapturedAt: Date | null;
    ownerTransferStatus: string;
    ownerTransferredAt: Date | null;
    stripeTransferId: string | null;
    payoutStatus: string;
    createdAt: Date;
    updatedAt: Date;
  };
  rental: {
    startDate: Date;
    endDate: Date;
    returnConfirmedAt: Date | null;
    totalAmount: string;
    securityDeposit: string;
  };
  dispute: {
    id: string;
    status: string;
    referenceNumber: number | null;
  } | null;
}): TimelineEvent[] {
  const { lifecycle, rental, dispute } = data;
  const events: TimelineEvent[] = [];

  events.push({
    key: "rental-start",
    label: "Rental period start",
    timestamp: rental.startDate,
    description: `Rental through ${formatDate(rental.endDate)}`,
  });

  if (lifecycle.rentalChargeId) {
    events.push({
      key: "charge-captured",
      label: "Rental charge captured",
      timestamp: lifecycle.createdAt,
      amount: `$${rental.totalAmount}`,
      stripeId: lifecycle.rentalChargeId,
    });
  }

  if (lifecycle.depositHoldStatus) {
    const depositLabel =
      lifecycle.depositHoldStatus === "scheduled"
        ? "Deposit hold scheduled"
        : lifecycle.depositHoldStatus === "held"
          ? "Deposit hold placed"
          : lifecycle.depositHoldStatus === "released"
            ? "Deposit released"
            : lifecycle.depositHoldStatus === "captured"
              ? "Deposit captured"
              : lifecycle.depositHoldStatus === "expired"
                ? "Deposit hold expired"
                : lifecycle.depositHoldStatus === "failed"
                  ? "Deposit hold failed"
                  : `Deposit: ${lifecycle.depositHoldStatus}`;
    const ts =
      lifecycle.depositHoldPlacedAt ??
      lifecycle.depositReleasedAt ??
      lifecycle.depositCapturedAt ??
      lifecycle.updatedAt;
    events.push({
      key: "deposit",
      label: depositLabel,
      timestamp: ts,
      amount: rental.securityDeposit ? `$${rental.securityDeposit}` : undefined,
    });
  }

  if (rental.returnConfirmedAt) {
    events.push({
      key: "return-confirmed",
      label: "Return confirmed",
      timestamp: rental.returnConfirmedAt,
    });
  }

  if (dispute) {
    events.push({
      key: "dispute",
      label: "Dispute filed",
      timestamp: null,
      description: `#${dispute.referenceNumber ?? dispute.id.slice(0, 8)} (${dispute.status})`,
      disputeId: dispute.id,
    });
  }

  if (
    lifecycle.ownerTransferStatus !== "pending" &&
    lifecycle.ownerTransferredAt
  ) {
    events.push({
      key: "transfer",
      label: `Owner transfer ${lifecycle.ownerTransferStatus}`,
      timestamp: lifecycle.ownerTransferredAt,
      stripeId: lifecycle.stripeTransferId ?? undefined,
    });
  } else if (lifecycle.ownerTransferStatus === "failed") {
    events.push({
      key: "transfer-failed",
      label: "Owner transfer failed",
      timestamp: lifecycle.updatedAt,
      stripeId: lifecycle.stripeTransferId ?? undefined,
    });
  }

  if (lifecycle.payoutStatus !== "pending") {
    events.push({
      key: "payout",
      label: `Payout ${lifecycle.payoutStatus}`,
      timestamp: lifecycle.updatedAt,
    });
  }

  events.sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  return events;
}

/**
 * Admin payment lifecycle detail: status, timeline, override actions, audit log. Requirements: 2.2, 6.1, 7.1, 8.1, 10.4
 */
export function PaymentLifecycleDetailClient({
  rentalId,
}: {
  rentalId: string;
}) {
  const { data, isLoading, error } = usePaymentLifecycleDetail(rentalId);
  const resetPayout = useResetPayoutStatus();
  const resetTransfer = useResetTransferStatus();
  const releaseDeposit = useReleaseDeposit();

  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState<
    "payout" | "transfer" | "deposit" | null
  >(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">
            Failed to load detail.{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { lifecycle, rental, dispute, auditLogEntries } = data;
  const canResetPayout =
    lifecycle.payoutStatus === "processing" ||
    lifecycle.payoutStatus === "failed";
  const canResetTransfer = lifecycle.ownerTransferStatus === "failed";
  const canReleaseDeposit = lifecycle.depositHoldStatus === "held";

  const handleResetPayout = () => {
    resetPayout.mutate(
      { rentalId, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setDialogOpen(null);
          setReason("");
        },
      },
    );
  };
  const handleResetTransfer = () => {
    resetTransfer.mutate(
      { rentalId, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setDialogOpen(null);
          setReason("");
        },
      },
    );
  };
  const handleReleaseDeposit = () => {
    releaseDeposit.mutate(rentalId, { onSuccess: () => setDialogOpen(null) });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(lifecycle.depositHoldStatus)}>
            Deposit: {lifecycle.depositHoldStatus}
          </Badge>
          <Badge variant={statusVariant(lifecycle.ownerTransferStatus)}>
            Transfer: {lifecycle.ownerTransferStatus}
          </Badge>
          <Badge variant={statusVariant(lifecycle.payoutStatus)}>
            Payout: {lifecycle.payoutStatus}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rental & payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Rental:</span>{" "}
            {rental.rentalId}
          </p>
          <p>
            <span className="text-muted-foreground">Dates:</span>{" "}
            {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
          </p>
          <p>
            <span className="text-muted-foreground">Total:</span> $
            {rental.totalAmount} | Deposit: ${rental.securityDeposit}
          </p>
          {lifecycle.rentalChargeId && (
            <p>
              <span className="text-muted-foreground">Charge ID:</span>{" "}
              {lifecycle.rentalChargeId}
            </p>
          )}
          {rental.returnConfirmedAt && (
            <p>
              <span className="text-muted-foreground">Return confirmed:</span>{" "}
              {formatDate(rental.returnConfirmedAt)}
            </p>
          )}
          {dispute && (
            <p>
              <span className="text-muted-foreground">Dispute:</span>{" "}
              <Link
                href={`/admin/dashboard/disputes/review?dispute=${dispute.id}`}
                className="text-primary hover:underline"
              >
                #{dispute.referenceNumber} ({dispute.status})
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment timeline</CardTitle>
          <p className="text-muted-foreground text-sm">
            Events in order: charge captured, deposit hold, return confirmed,
            dispute (if any), deposit release/capture/expiry, transfer, payout.
          </p>
        </CardHeader>
        <CardContent>
          {(() => {
            const timeline = buildPaymentTimeline({
              lifecycle,
              rental,
              dispute,
            });
            if (timeline.length === 0) {
              return (
                <p className="text-muted-foreground text-sm">
                  No timeline events yet.
                </p>
              );
            }
            return (
              <ul className="space-y-0">
                {timeline.map((event, i) => (
                  <li
                    key={event.key}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {i < timeline.length - 1 && (
                      <span
                        className="bg-muted absolute top-6 left-[7px] h-[calc(100%-0.5rem)] w-px"
                        aria-hidden
                      />
                    )}
                    <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{event.label}</p>
                      {event.timestamp && (
                        <p className="text-muted-foreground text-xs">
                          {formatDate(event.timestamp)}
                        </p>
                      )}
                      {(event.amount ||
                        event.stripeId ||
                        event.description ||
                        event.disputeId) && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {event.amount}
                          {event.amount && event.stripeId && " · "}
                          {event.stripeId && (
                            <span className="font-mono">{event.stripeId}</span>
                          )}
                          {event.disputeId ? (
                            <>
                              {" · "}
                              <Link
                                href={`/admin/dashboard/disputes/review?dispute=${event.disputeId}`}
                                className="text-primary hover:underline"
                              >
                                {event.description ?? "View dispute"}
                              </Link>
                            </>
                          ) : (
                            event.description &&
                            (event.amount || event.stripeId
                              ? ` · ${event.description}`
                              : event.description)
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Override actions</CardTitle>
          <p className="text-muted-foreground text-sm">
            Use these only when you have verified the state and need to retry or
            release.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canResetPayout && (
            <Dialog
              open={dialogOpen === "payout"}
              onOpenChange={(o) => setDialogOpen(o ? "payout" : null)}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Reset payout status
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset payout status</DialogTitle>
                  <DialogDescription>
                    Set payout status from {lifecycle.payoutStatus} back to
                    pending so the cron can retry.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="reason-payout">Reason (optional)</Label>
                  <Input
                    id="reason-payout"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Stripe timeout, manual retry"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResetPayout}
                    disabled={resetPayout.isPending}
                  >
                    {resetPayout.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Reset"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canResetTransfer && (
            <Dialog
              open={dialogOpen === "transfer"}
              onOpenChange={(o) => setDialogOpen(o ? "transfer" : null)}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Reset transfer status
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset transfer status</DialogTitle>
                  <DialogDescription>
                    Set owner transfer status from failed back to pending.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="reason-transfer">Reason (optional)</Label>
                  <Input
                    id="reason-transfer"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Retry after Stripe fix"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResetTransfer}
                    disabled={resetTransfer.isPending}
                  >
                    {resetTransfer.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Reset"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canReleaseDeposit && (
            <Dialog
              open={dialogOpen === "deposit"}
              onOpenChange={(o) => setDialogOpen(o ? "deposit" : null)}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Release deposit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Release deposit hold</DialogTitle>
                  <DialogDescription>
                    Cancel the security deposit PaymentIntent so the hold is
                    released. The renter will be notified.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReleaseDeposit}
                    disabled={releaseDeposit.isPending}
                  >
                    {releaseDeposit.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Release"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {!canResetPayout && !canResetTransfer && !canReleaseDeposit && (
            <p className="text-muted-foreground text-sm">
              No override actions available for current status.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No audit entries.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditLogEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap gap-x-2 gap-y-1 border-b pb-2 last:border-0"
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatDate(entry.createdAt)}
                  </span>
                  <span className="font-medium">{entry.action}</span>
                  {entry.userId && (
                    <span className="text-muted-foreground">
                      by {entry.userId.slice(0, 8)}…
                    </span>
                  )}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {JSON.stringify(entry.metadata)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

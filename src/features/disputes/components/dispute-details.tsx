"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  DollarSign,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "@/lib/utils/date.utils";
import { useDispute } from "../hooks";
import { DisputeStatusBadge } from "./dispute-status-badge";
import {
  formatDisputeId,
  formatDisputeIdentifier,
} from "../utils/format-dispute-id";
import { AdminResolutionPanel } from "./admin-resolution-panel";
import { InternalNotesSection } from "./internal-notes-section";
import { AdminStateControls } from "./admin-state-controls";

interface DisputeDetailsProps {
  disputeId: string;
  isAdmin?: boolean;
}

/**
 * Client component for displaying dispute details
 * Shows all dispute information, evidence, timeline, resolution, and financial operations
 * Admin-only sections: internal notes and action buttons
 */
export function DisputeDetails({
  disputeId,
  isAdmin = false,
}: DisputeDetailsProps) {
  const { data: dispute, isLoading, error } = useDispute(disputeId);

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDeadline = (deadline: Date | string | null) => {
    if (!deadline) return null;
    // Convert string to Date if needed (dates from API are serialized as strings)
    const deadlineDate =
      deadline instanceof Date ? deadline : new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    if (diffMs <= 0) return "Expired";
    return formatDistanceToNow(deadlineDate, { addSuffix: false });
  };

  const getReasonCodeLabel = (code: string) => {
    const labels: Record<string, string> = {
      damage: "Damage",
      non_delivery: "Non-Delivery",
      quality_issue: "Quality Issue",
      cancellation: "Cancellation",
      payment_issue: "Payment Issue",
      other: "Other",
    };
    return labels[code] || code;
  };

  const getRoleLabel = (role: string) => {
    return role === "renter" ? "Renter" : "Provider";
  };

  const getResolutionOutcomeLabel = (outcome: string | null) => {
    if (!outcome) return "N/A";
    const labels: Record<string, string> = {
      favor_renter: "Favor Renter",
      favor_provider: "Favor Provider",
      partial_renter: "Partial - Favor Renter",
      partial_provider: "Partial - Favor Provider",
      dismissed: "Dismissed",
    };
    return labels[outcome] || outcome;
  };

  const getFinancialOperationLabel = (type: string) => {
    const labels: Record<string, string> = {
      hold_payout: "Hold Payout",
      refund_partial: "Partial Refund",
      refund_full: "Full Refund",
      capture_deposit: "Capture Deposit",
    };
    return labels[type] || type;
  };

  const getFinancialOperationStatusBadge = (status: string) => {
    const config = {
      pending: {
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "Pending",
      },
      succeeded: {
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Succeeded",
      },
      failed: {
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Failed",
      },
    };
    const statusConfig =
      config[status as keyof typeof config] || config.pending;
    return (
      <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
    );
  };

  // Filter audit logs for state transitions
  const stateTransitions =
    dispute?.auditLogs?.filter((log) => log.actionType === "state_change") ||
    [];

  // Separate evidence by type
  const imageEvidence =
    dispute?.evidence?.filter((e) => e.evidenceType === "image") || [];
  const textEvidence =
    dispute?.evidence?.filter((e) => e.evidenceType === "text") || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-center">
            Loading dispute details...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-destructive text-center">
            <AlertCircle className="mx-auto mb-2 h-6 w-6" />
            <p>Failed to load dispute details</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dispute) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-center">
            Dispute not found
          </div>
        </CardContent>
      </Card>
    );
  }

  const disputeIdentifier = formatDisputeIdentifier(
    dispute.referenceNumber,
    dispute.rental?.listing?.name,
  );

  const deadline = formatDeadline(dispute.evidenceDeadline);

  return (
    <div className="space-y-6">
      {/* Dispute Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <span>Dispute {formatDisputeId(dispute.referenceNumber)}</span>
                <DisputeStatusBadge status={dispute.status} />
              </CardTitle>
              <CardDescription className="mt-2">
                {disputeIdentifier} • {getReasonCodeLabel(dispute.reasonCode)}
              </CardDescription>
            </div>
            {dispute.rental && (
              <Link
                href={`/dashboard/rental/${dispute.rental.requestId}`}
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                View Rental
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">{formatDateTime(dispute.createdAt)}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                by {getRoleLabel(dispute.createdByRole)}
                {dispute.createdByUser &&
                  ` (${
                    (dispute.createdByUser.firstName || "").trim() &&
                    (dispute.createdByUser.lastName || "").trim()
                      ? `${dispute.createdByUser.firstName} ${dispute.createdByUser.lastName}`.trim()
                      : dispute.createdByUser.email
                  })`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Last Updated</p>
              <p className="font-medium">{formatDateTime(dispute.updatedAt)}</p>
            </div>
            {deadline && (
              <div>
                <p className="text-muted-foreground text-sm">
                  Evidence Deadline
                </p>
                <p className="font-medium">
                  {formatDateTime(dispute.evidenceDeadline)}
                </p>
              </div>
            )}
            {dispute.policyVersion && (
              <div>
                <p className="text-muted-foreground text-sm">Policy Version</p>
                <p className="font-medium">{dispute.policyVersion}</p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-muted-foreground mb-2 text-sm font-semibold">
              Description
            </p>
            <p className="text-sm leading-relaxed">{dispute.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Section */}
      {(imageEvidence.length > 0 || textEvidence.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidence ({dispute.evidence?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Image Evidence */}
            {imageEvidence.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="h-4 w-4" />
                  Images ({imageEvidence.length})
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {imageEvidence.map((evidence) => (
                    <Dialog key={evidence.id}>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="relative aspect-square overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
                        >
                          <Image
                            src={evidence.content}
                            alt="Evidence image"
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Evidence Image</DialogTitle>
                        </DialogHeader>
                        <div className="relative aspect-video w-full">
                          <Image
                            src={evidence.content}
                            alt="Evidence image"
                            fill
                            className="object-contain"
                            sizes="100vw"
                          />
                        </div>
                        <div className="text-muted-foreground text-sm">
                          <p>
                            Uploaded by: {getRoleLabel(evidence.uploadedByRole)}
                          </p>
                          <p>Uploaded: {formatDateTime(evidence.uploadedAt)}</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>
              </div>
            )}

            {/* Text Evidence */}
            {textEvidence.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  Text Evidence ({textEvidence.length})
                </h3>
                <div className="space-y-3">
                  {textEvidence.map((evidence) => (
                    <Card key={evidence.id}>
                      <CardContent className="pt-6">
                        <p className="mb-2 text-sm leading-relaxed whitespace-pre-wrap">
                          {evidence.content}
                        </p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                          <span>
                            Uploaded by: {getRoleLabel(evidence.uploadedByRole)}
                          </span>
                          <span>{formatDateTime(evidence.uploadedAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {stateTransitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stateTransitions.map((transition, index) => (
                <div key={transition.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="bg-primary h-3 w-3 rounded-full" />
                    {index < stateTransitions.length - 1 && (
                      <div className="bg-border h-full w-0.5" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {transition.previousState || "N/A"} →{" "}
                        {transition.newState || "N/A"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {formatDateTime(transition.createdAt)}
                    </p>
                    {transition.reason && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {transition.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolution Information */}
      {dispute.status === "resolved" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-sm">Outcome</p>
                <p className="font-medium">
                  {getResolutionOutcomeLabel(dispute.resolutionOutcome)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Resolved At</p>
                <p className="font-medium">
                  {formatDateTime(dispute.resolvedAt)}
                </p>
              </div>
              {dispute.resolvedByUser && (
                <div>
                  <p className="text-muted-foreground text-sm">Resolved By</p>
                  <p className="font-medium">
                    {dispute.resolvedByUser.firstName || ""}{" "}
                    {dispute.resolvedByUser.lastName || ""}
                  </p>
                </div>
              )}
            </div>
            {dispute.resolutionReason && (
              <div>
                <p className="text-muted-foreground mb-2 text-sm font-semibold">
                  Resolution Reason
                </p>
                <p className="text-sm leading-relaxed">
                  {dispute.resolutionReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financial Operations */}
      {dispute.financialOperations &&
        dispute.financialOperations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Operations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dispute.financialOperations.map((operation) => (
                  <Card key={operation.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {getFinancialOperationLabel(
                                operation.operationType,
                              )}
                            </p>
                            {getFinancialOperationStatusBadge(operation.status)}
                          </div>
                          {operation.amount && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              Amount: ${parseFloat(operation.amount).toFixed(2)}
                            </p>
                          )}
                          <p className="text-muted-foreground mt-1 text-sm">
                            {formatDateTime(operation.performedAt)}
                          </p>
                          {operation.errorMessage && (
                            <p className="text-destructive mt-2 text-sm">
                              Error: {operation.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Admin-Only Sections */}
      {isAdmin && (
        <>
          {/* Admin State Controls */}
          <AdminStateControls disputeId={disputeId} />

          {/* Admin Resolution Panel */}
          <AdminResolutionPanel
            disputeId={disputeId}
            currentStatus={dispute.status}
          />

          {/* Internal Notes Section */}
          <InternalNotesSection disputeId={disputeId} />
        </>
      )}
    </div>
  );
}

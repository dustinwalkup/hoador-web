"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  AlertTriangle,
  AlertCircle,
  MapPin,
  Package,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DisputeWithRelations } from "@/dal/types";
import { DisputeStatusBadge } from "@/features/disputes/components/dispute-status-badge";
import { RetryDepositButton } from "./retry-deposit-button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RentalStatusProgressProps {
  currentStatus: string;
  userRole: "renter" | "owner";
  rentalId: string;
  deliveryRequested: boolean;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  approvedAt?: Date | null;
  deniedAt?: Date | null;
  denialReason?: string | null;
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  paymentStatus?: string | null;
  paymentFailureReason?: string | null;
  depositHoldStatus?: string | null;
  pickupInstructions?: string | null;
  returnInstructions?: string | null;
  activeDispute?: DisputeWithRelations | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["denied", "cancelled"]);

const NORMAL_STEPS = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns the state for each step based on rental status.
 * The ring (●) only appears on "Active" when the rental is genuinely in progress.
 * All other steps are either done (✓) or future (○) — no in-between.
 */
function getStepStates(
  status: string,
): [StepState, StepState, StepState, StepState] {
  switch (status) {
    case "pending":
      return ["done", "future", "future", "future"];
    case "approved":
      return ["done", "done", "future", "future"];
    case "active":
    case "overdue":
      return ["done", "done", "current", "future"];
    case "completed":
      return ["done", "done", "done", "done"];
    default:
      return ["done", "future", "future", "future"];
  }
}

/** Explanation shown only on the Active step when the rental is running. */
function getActiveExplanation(
  status: string,
  userRole: "renter" | "owner",
  deliveryRequested: boolean,
): string {
  if (status === "active") {
    if (userRole === "renter") {
      return deliveryRequested
        ? "Rental is active. Arrange return delivery with the owner by the end date."
        : "Rental is active. Return the item to the owner by the end date.";
    }
    return deliveryRequested
      ? "Item is out on rent. The renter will arrange return delivery by the end date."
      : "Item is out on rent. Expect it back by the end date.";
  }
  if (status === "overdue") {
    return userRole === "renter"
      ? "This rental is past its end date. Please return the item immediately."
      : "This rental is overdue. Contact the renter to arrange the return.";
  }
  return "";
}

function getEvidenceDeadlineInfo(
  dispute: DisputeWithRelations | null | undefined,
) {
  if (!dispute) return null;

  const deadline =
    dispute.status === "evidence_requested"
      ? dispute.evidenceDeadline
      : dispute.additionalEvidenceDeadline;

  if (!deadline) return null;

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const timeRemaining = deadlineDate.getTime() - now.getTime();

  if (timeRemaining <= 0) return { expired: true, deadline: deadlineDate };

  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  return { expired: false, deadline: deadlineDate, days, hours };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TimelineItem({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {Icon ? (
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconClassName)} />
      ) : (
        <div className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
      )}
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

type StepState = "done" | "current" | "future";

interface StepDotProps {
  label: string;
  state: StepState;
  isOverdue?: boolean;
  subLabel?: string;
  subLabelWarning?: boolean;
  explanation?: string;
  details?: React.ReactNode;
}

function StepDot({
  label,
  state,
  isOverdue,
  subLabel,
  subLabelWarning,
  explanation,
  details,
}: StepDotProps) {
  const isDone = state === "done";
  const isCurrent = state === "current";
  const isInteractive = (isDone || isCurrent) && (!!explanation || !!details);

  const dotInner = isDone ? (
    <Check className="h-4 w-4" strokeWidth={2.5} />
  ) : isCurrent && isOverdue ? (
    <AlertTriangle className="h-4 w-4" />
  ) : isCurrent ? (
    <div className="bg-primary h-2.5 w-2.5 rounded-full" />
  ) : (
    <div className="bg-muted-foreground/25 h-2.5 w-2.5 rounded-full" />
  );

  const dotCls = cn(
    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200",
    isDone && "border-primary bg-primary text-primary-foreground",
    isCurrent && !isOverdue && "border-primary bg-background text-primary",
    isCurrent &&
      isOverdue &&
      "border-amber-500 bg-amber-50 text-amber-600 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-400",
    state === "future" && "border-muted-foreground/25 bg-background",
  );

  const labelCls = cn(
    "text-center text-xs font-medium leading-tight",
    isDone && "text-foreground",
    isCurrent && !isOverdue && "text-primary",
    isCurrent && isOverdue && "text-amber-600 dark:text-amber-400",
    state === "future" && "text-muted-foreground",
  );

  if (!isInteractive) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className={dotCls}>{dotInner}</div>
        <span className={labelCls}>{label}</span>
        {subLabel && (
          <span
            className={cn(
              "text-center text-[10px] leading-tight",
              subLabelWarning
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {subLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} — view details`}
          className="group focus-visible:ring-primary flex shrink-0 flex-col items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <div
            className={cn(
              dotCls,
              "group-hover:scale-110 group-hover:shadow-md",
              isDone && "group-hover:ring-primary/15 group-hover:ring-4",
              isCurrent &&
                !isOverdue &&
                "group-hover:ring-primary/20 group-hover:ring-4",
              isCurrent &&
                isOverdue &&
                "group-hover:ring-4 group-hover:ring-amber-500/20",
            )}
          >
            {dotInner}
          </div>
          <span className={cn(labelCls, isDone && "group-hover:text-primary")}>
            {label}
          </span>
          {subLabel && (
            <span
              className={cn(
                "text-center text-[10px] leading-tight",
                subLabelWarning
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              {subLabel}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" side="bottom" align="center">
        <p className="text-sm font-semibold">{label}</p>
        {explanation && (
          <p className="text-muted-foreground mt-1 text-sm">{explanation}</p>
        )}
        {details && (
          <div className="mt-3 space-y-2 border-t pt-3">{details}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TerminalStateBadge({
  status,
  deniedAt,
  denialReason,
  userRole,
}: {
  status: string;
  deniedAt?: Date | null;
  denialReason?: string | null;
  userRole: "renter" | "owner";
}) {
  const isDenied = status === "denied";
  const explanation = isDenied
    ? userRole === "renter"
      ? "Your rental request was declined by the owner."
      : "You declined this rental request."
    : "This rental was cancelled.";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Badge
          variant={isDenied ? "destructive" : "secondary"}
          className="capitalize"
        >
          {status}
        </Badge>
        <p className="text-muted-foreground text-sm">{explanation}</p>
      </div>

      {isDenied && deniedAt && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">
            {userRole === "renter" ? "Declined" : "You declined"} on{" "}
            {formatDate(deniedAt)}
          </span>
        </div>
      )}

      {isDenied && denialReason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm text-red-800 dark:text-red-300">
            <strong>Reason:</strong> {denialReason}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function RentalStatusProgress({
  currentStatus,
  userRole,
  rentalId,
  deliveryRequested,
  startDate,
  endDate,
  createdAt,
  approvedAt,
  deniedAt,
  denialReason,
  actualStartDate,
  actualEndDate,
  paymentStatus,
  paymentFailureReason,
  depositHoldStatus,
  pickupInstructions,
  returnInstructions,
  activeDispute,
}: RentalStatusProgressProps) {
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);
  const isOverdue = currentStatus === "overdue";
  const stepStates = getStepStates(currentStatus);
  const evidenceDeadlineInfo = getEvidenceDeadlineInfo(activeDispute);
  const isRenter = userRole === "renter";
  // eslint-disable-next-line react-hooks/purity
  const now = useRef(Date.now()).current;

  // Per-step popover details — only shown for done and current steps
  function buildStepDetails(
    stepKey: string,
    stepState: StepState,
  ): React.ReactNode {
    switch (stepKey) {
      case "requested":
        if (stepState === "future") return null;
        return (
          <TimelineItem>Submitted on {formatDate(createdAt)}</TimelineItem>
        );

      case "accepted":
        if (stepState !== "done") return null;
        return (
          <>
            {approvedAt && (
              <TimelineItem>Approved on {formatDate(approvedAt)}</TimelineItem>
            )}
            {depositHoldStatus === "held" && (
              <TimelineItem icon={Shield} iconClassName="text-green-500">
                Security deposit hold placed
              </TimelineItem>
            )}
            {pickupInstructions && (
              <TimelineItem icon={MapPin} iconClassName="text-blue-500">
                <span>
                  <span className="text-foreground font-medium">Pickup: </span>
                  {pickupInstructions}
                </span>
              </TimelineItem>
            )}
          </>
        );

      case "active":
        if (stepState === "future") return null;
        return (
          <>
            {actualStartDate && (
              <TimelineItem>
                Started on {formatDate(actualStartDate)}
              </TimelineItem>
            )}
            {stepState === "current" && returnInstructions && (
              <TimelineItem icon={Package} iconClassName="text-blue-500">
                <span>
                  <span className="text-foreground font-medium">Return: </span>
                  {returnInstructions}
                </span>
              </TimelineItem>
            )}
          </>
        );

      case "completed":
        if (stepState !== "done") return null;
        return actualEndDate ? (
          <TimelineItem>Completed on {formatDate(actualEndDate)}</TimelineItem>
        ) : null;

      default:
        return null;
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-5 text-xl font-semibold">Rental Status</h2>

        {/* ── Terminal state ── */}
        {isTerminal ? (
          <TerminalStateBadge
            status={currentStatus}
            deniedAt={deniedAt}
            denialReason={denialReason}
            userRole={userRole}
          />
        ) : (
          <>
            {/* ── Horizontal stepper ── */}
            <div className="flex w-full items-start">
              {NORMAL_STEPS.map((step, idx) => {
                const stepState = stepStates[idx];
                const isLast = idx === NORMAL_STEPS.length - 1;
                // Explanation only shown on the Active step when actively running
                const explanation =
                  stepState === "current"
                    ? getActiveExplanation(
                        currentStatus,
                        userRole,
                        deliveryRequested,
                      )
                    : undefined;
                const details = buildStepDetails(step.key, stepState);
                // Line fills when the NEXT step is done or current (leads into completed work)
                const nextStepState = !isLast ? stepStates[idx + 1] : null;
                const lineFilled =
                  nextStepState === "done" || nextStepState === "current";
                // Show the relevant upcoming date only on the first future step
                const isNextStep =
                  stepState === "future" && stepStates[idx - 1] !== "future";
                const subLabel = isNextStep
                  ? step.key === "active"
                    ? formatShortDate(startDate)
                    : step.key === "completed"
                      ? formatShortDate(endDate)
                      : undefined
                  : undefined;
                const subLabelWarning = isNextStep
                  ? step.key === "active"
                    ? new Date(startDate).getTime() < now
                    : step.key === "completed"
                      ? new Date(endDate).getTime() < now
                      : false
                  : false;

                return (
                  <Fragment key={step.key}>
                    <StepDot
                      label={step.label}
                      state={stepState}
                      isOverdue={isOverdue && stepState === "current"}
                      subLabel={subLabel}
                      subLabelWarning={subLabelWarning}
                      explanation={explanation}
                      details={details ?? undefined}
                    />
                    {!isLast && (
                      <div
                        className={cn(
                          "mt-[18px] h-0.5 flex-1 transition-colors duration-300",
                          lineFilled ? "bg-primary" : "bg-muted-foreground/20",
                        )}
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>

            {/* ── Overdue banner ── */}
            {isOverdue && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  This rental is past its return date
                </p>
              </div>
            )}

            {/* ── Dispute banner ── */}
            {activeDispute && (
              <div className="mt-4 flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">
                      Active dispute
                    </span>
                  </div>
                  <DisputeStatusBadge status={activeDispute.status} />
                </div>
                <Link href={`/dashboard/disputes/${activeDispute.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    View Dispute
                  </Button>
                </Link>
              </div>
            )}

            {/* ── Evidence deadline countdown ── */}
            {activeDispute && evidenceDeadlineInfo && (
              <div
                className={cn(
                  "mt-4 flex items-start gap-2 rounded-md border p-3",
                  evidenceDeadlineInfo.expired
                    ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                    : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20",
                )}
              >
                <Clock
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    evidenceDeadlineInfo.expired
                      ? "text-red-600 dark:text-red-400"
                      : "text-yellow-600 dark:text-yellow-400",
                  )}
                />
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      evidenceDeadlineInfo.expired
                        ? "text-red-800 dark:text-red-300"
                        : "text-yellow-800 dark:text-yellow-300",
                    )}
                  >
                    {evidenceDeadlineInfo.expired
                      ? "Evidence deadline expired"
                      : "Evidence deadline approaching"}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      evidenceDeadlineInfo.expired
                        ? "text-red-700 dark:text-red-400"
                        : "text-yellow-700 dark:text-yellow-400",
                    )}
                  >
                    {evidenceDeadlineInfo.expired
                      ? `Deadline was ${formatDate(evidenceDeadlineInfo.deadline)}`
                      : `Deadline: ${formatDate(evidenceDeadlineInfo.deadline)} (${evidenceDeadlineInfo.days}d ${evidenceDeadlineInfo.hours}h remaining)`}
                  </p>
                </div>
              </div>
            )}

            {/* ── Payment failed banner ── */}
            {paymentStatus === "failed" && (
              <div className="mt-4 space-y-2 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    Payment declined
                  </span>
                </div>
                <div className="ml-4 space-y-1">
                  {paymentFailureReason && (
                    <p className="text-xs text-orange-800 dark:text-orange-300">
                      <strong>Reason:</strong> {paymentFailureReason}
                    </p>
                  )}
                  {isRenter && (
                    <Link
                      href="/dashboard/payments"
                      className="text-xs font-medium text-orange-800 underline underline-offset-2 hover:text-orange-900 dark:text-orange-300"
                    >
                      Update payment method
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* ── Deposit hold failed banner ── */}
            {depositHoldStatus === "failed" && (
              <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Security deposit hold failed
                  </span>
                </div>
                <div className="ml-4 space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {isRenter
                      ? "The security deposit hold could not be placed on your payment method. Update your payment method and retry."
                      : "The security deposit hold could not be placed. The rental is proceeding without deposit protection."}
                  </p>
                  {isRenter && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href="/dashboard/profile/payments"
                        className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300"
                      >
                        Update payment method
                      </Link>
                      <RetryDepositButton rentalId={rentalId} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

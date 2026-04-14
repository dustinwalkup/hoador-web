"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";
import { Check, AlertCircle, AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceBookingStatus =
  | "pending"
  | "accepted"
  | "completed"
  | "cancelled"
  | "declined"
  | "payment_failed"
  | "no_show";

export interface ServiceStatusProgressProps {
  currentStatus: ServiceBookingStatus;
  userRole: "client" | "provider";
  scheduledDate: Date;
  completedAt?: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NORMAL_STEPS = [
  { key: "requested", label: "Requested" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
] as const;

const TERMINAL_STATUSES = new Set<ServiceBookingStatus>([
  "cancelled",
  "declined",
  "payment_failed",
  "no_show",
]);

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
 * Returns the state for each step based on booking status.
 * Services have no "active" mid-state, so steps are only done (✓) or future (○).
 * No ring is ever shown — a booking is either pending, scheduled, or done.
 */
function getStepStates(
  status: ServiceBookingStatus,
): [StepState, StepState, StepState] {
  switch (status) {
    case "pending":
      return ["done", "future", "future"];
    case "accepted":
      return ["done", "done", "future"];
    case "completed":
      return ["done", "done", "done"];
    default:
      return ["done", "future", "future"];
  }
}

function getTerminalConfig(
  status: ServiceBookingStatus,
  userRole: "client" | "provider",
): {
  label: string;
  variant: "destructive" | "secondary" | "outline";
  explanation: string;
} {
  switch (status) {
    case "cancelled":
      return {
        label: "Cancelled",
        variant: "outline",
        explanation: "This booking was cancelled.",
      };
    case "declined":
      return {
        label: "Declined",
        variant: "destructive",
        explanation:
          userRole === "client"
            ? "The provider declined this booking request."
            : "You declined this booking request.",
      };
    case "payment_failed":
      return {
        label: "Payment Failed",
        variant: "destructive",
        explanation:
          userRole === "client"
            ? "Payment failed when the provider accepted. Please update your payment method."
            : "Payment failed when you accepted. The client has been notified.",
      };
    case "no_show":
      return {
        label: "No Show",
        variant: "destructive",
        explanation:
          userRole === "client"
            ? "This appointment was reported as a no-show."
            : "You reported this as a no-show.",
      };
    default:
      return { label: status, variant: "secondary", explanation: "" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TimelineItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

type StepState = "done" | "current" | "future";

interface StepDotProps {
  label: string;
  state: StepState;
  subLabel?: string;
  subLabelWarning?: boolean;
  explanation?: string;
  details?: React.ReactNode;
}

function StepDot({
  label,
  state,
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
  ) : isCurrent ? (
    <div className="bg-primary h-2.5 w-2.5 rounded-full" />
  ) : (
    <div className="bg-muted-foreground/25 h-2.5 w-2.5 rounded-full" />
  );

  const dotCls = cn(
    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200",
    isDone && "border-primary bg-primary text-primary-foreground",
    isCurrent && "border-primary bg-background text-primary",
    state === "future" && "border-muted-foreground/25 bg-background",
  );

  const labelCls = cn(
    "text-center text-xs font-medium leading-tight",
    isDone && "text-foreground",
    isCurrent && "text-primary",
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
              isCurrent && "group-hover:ring-primary/20 group-hover:ring-4",
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Horizontal stepper for a service booking's progress.
 * Handles Requested → Accepted → Completed and terminal states
 * (Cancelled, Declined, Payment Failed, No Show).
 * Each completed or current step is tappable to view milestone details.
 */
export function ServiceStatusProgress({
  currentStatus,
  userRole,
  scheduledDate,
  completedAt,
}: ServiceStatusProgressProps) {
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);
  const stepStates = getStepStates(currentStatus);
  // eslint-disable-next-line react-hooks/purity
  const now = useRef(Date.now()).current;

  function buildStepDetails(
    stepKey: string,
    stepState: StepState,
  ): React.ReactNode {
    switch (stepKey) {
      case "requested":
        if (stepState === "future") return null;
        return (
          <TimelineItem>Scheduled for {formatDate(scheduledDate)}</TimelineItem>
        );

      case "accepted":
        if (stepState !== "done") return null;
        return (
          <TimelineItem>Scheduled for {formatDate(scheduledDate)}</TimelineItem>
        );

      case "completed":
        if (stepState !== "done") return null;
        return completedAt ? (
          <TimelineItem>Completed on {formatDate(completedAt)}</TimelineItem>
        ) : null;

      default:
        return null;
    }
  }

  if (isTerminal) {
    const config = getTerminalConfig(currentStatus, userRole);
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge variant={config.variant} className="capitalize">
            {config.label}
          </Badge>
          <p className="text-muted-foreground text-sm">{config.explanation}</p>
        </div>

        {currentStatus === "payment_failed" && userRole === "client" && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Go to{" "}
              <Link
                href="/dashboard/payments"
                className="font-medium underline underline-offset-2"
              >
                Payment methods
              </Link>{" "}
              to update your card and contact support to reschedule.
            </p>
          </div>
        )}

        {currentStatus === "no_show" && (
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <p className="text-xs text-orange-800 dark:text-orange-300">
              If you believe this is an error, please contact support.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-start">
      {NORMAL_STEPS.map((step, idx) => {
        const stepState = stepStates[idx];
        const isLast = idx === NORMAL_STEPS.length - 1;
        const details = buildStepDetails(step.key, stepState);
        // Line fills when the NEXT step is done (leads into completed work)
        const nextStepState = !isLast ? stepStates[idx + 1] : null;
        const lineFilled = nextStepState === "done";
        // Show scheduled date below the first future step when it's meaningful
        const isNextStep =
          stepState === "future" && stepStates[idx - 1] !== "future";
        const subLabel =
          isNextStep && step.key === "completed"
            ? formatShortDate(scheduledDate)
            : undefined;
        const subLabelWarning =
          isNextStep && step.key === "completed"
            ? new Date(scheduledDate).getTime() < now
            : false;

        return (
          <Fragment key={step.key}>
            <StepDot
              label={step.label}
              state={stepState}
              subLabel={subLabel}
              subLabelWarning={subLabelWarning}
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
  );
}

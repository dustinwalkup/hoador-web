"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDispute, useUpdateDisputeState } from "../hooks";
import { DisputeStateMachine } from "../lib/state-machine";
import { DisputeStatusBadge } from "./dispute-status-badge";
import type { DisputeStatus } from "@/dal/types";

interface AdminStateControlsProps {
  disputeId: string;
}

/**
 * Admin-only component for managing dispute state transitions
 * Shows current state and buttons for valid transitions
 */
export function AdminStateControls({ disputeId }: AdminStateControlsProps) {
  const [transitionState, setTransitionState] = useState<{
    targetState: DisputeStatus | null;
    reason: string;
  }>({
    targetState: null,
    reason: "",
  });

  const { data: dispute } = useDispute(disputeId);
  const updateState = useUpdateDisputeState(disputeId);

  if (!dispute) {
    return null;
  }

  const currentStatus = dispute.status;
  const validNextStates = DisputeStateMachine.getValidNextStates(currentStatus);
  const isFinalState = DisputeStateMachine.isFinalState(currentStatus);

  const handleTransitionClick = (targetState: DisputeStatus) => {
    setTransitionState({ targetState, reason: "" });
  };

  const handleConfirmTransition = async () => {
    if (!transitionState.targetState) return;

    // Validate transition
    const validation = DisputeStateMachine.validateTransition(
      currentStatus,
      transitionState.targetState,
      true, // isAdmin
    );

    if (!validation.valid) {
      return;
    }

    await updateState.mutateAsync({
      newState: transitionState.targetState,
      reason: transitionState.reason || undefined,
    });

    setTransitionState({ targetState: null, reason: "" });
  };

  const getStateLabel = (status: DisputeStatus): string => {
    const labels: Record<DisputeStatus, string> = {
      open: "Open",
      evidence_requested: "Request Evidence",
      under_review: "Under Review",
      resolved: "Resolved",
      closed: "Closed",
    };
    return labels[status] || status;
  };

  const getStateDescription = (status: DisputeStatus): string => {
    const descriptions: Record<DisputeStatus, string> = {
      open: "Dispute is open and awaiting action",
      evidence_requested: "Request evidence from the renter or provider",
      under_review: "Move dispute to review status",
      resolved: "Mark dispute as resolved",
      closed: "Close the dispute (final state)",
    };
    return descriptions[status] || "";
  };

  // Don't show if dispute is in final state
  if (isFinalState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>State Management</CardTitle>
          <CardDescription>
            Dispute is in a final state and cannot be modified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              Current State:
            </span>
            <DisputeStatusBadge status={currentStatus} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Special handling for evidence_requested state
  if (
    currentStatus === "open" &&
    validNextStates.includes("evidence_requested")
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>State Management</CardTitle>
          <CardDescription>
            Manage dispute state transitions (admin only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              Current State:
            </span>
            <DisputeStatusBadge status={currentStatus} />
          </div>

          <div className="space-y-2">
            <Label>Available Actions</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handleTransitionClick("evidence_requested")}
                disabled={updateState.isPending}
              >
                Request Evidence
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTransitionClick("under_review")}
                disabled={updateState.isPending}
              >
                Move to Review
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTransitionClick("resolved")}
                disabled={updateState.isPending}
              >
                Resolve
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Transition Confirmation Dialog */}
        <AlertDialog
          open={transitionState.targetState !== null}
          onOpenChange={(open) =>
            !open && setTransitionState({ targetState: null, reason: "" })
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm State Transition</AlertDialogTitle>
              <AlertDialogDescription>
                {transitionState.targetState && (
                  <>
                    Are you sure you want to transition this dispute from{" "}
                    <strong>{getStateLabel(currentStatus)}</strong> to{" "}
                    <strong>
                      {getStateLabel(transitionState.targetState)}
                    </strong>
                    ?
                    <p className="mt-2 text-sm">
                      {getStateDescription(transitionState.targetState)}
                    </p>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter a reason for this state change..."
                  value={transitionState.reason}
                  onChange={(e) =>
                    setTransitionState({
                      ...transitionState,
                      reason: e.target.value,
                    })
                  }
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmTransition}
                disabled={updateState.isPending}
              >
                {updateState.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transitioning...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Confirm Transition
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  // For other states, show available transitions
  if (validNextStates.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>State Management</CardTitle>
        <CardDescription>
          Manage dispute state transitions (admin only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Current State:</span>
          <DisputeStatusBadge status={currentStatus} />
        </div>

        <div className="space-y-2">
          <Label>Available Transitions</Label>
          <div className="flex flex-wrap gap-2">
            {validNextStates.map((nextState) => (
              <Button
                key={nextState}
                variant="outline"
                onClick={() => handleTransitionClick(nextState)}
                disabled={updateState.isPending}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {getStateLabel(nextState)}
              </Button>
            ))}
          </div>
        </div>

        {/* Transition Confirmation Dialog */}
        <AlertDialog
          open={transitionState.targetState !== null}
          onOpenChange={(open) =>
            !open && setTransitionState({ targetState: null, reason: "" })
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm State Transition</AlertDialogTitle>
              <AlertDialogDescription>
                {transitionState.targetState && (
                  <>
                    Are you sure you want to transition this dispute from{" "}
                    <strong>{getStateLabel(currentStatus)}</strong> to{" "}
                    <strong>
                      {getStateLabel(transitionState.targetState)}
                    </strong>
                    ?
                    <p className="mt-2 text-sm">
                      {getStateDescription(transitionState.targetState)}
                    </p>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter a reason for this state change..."
                  value={transitionState.reason}
                  onChange={(e) =>
                    setTransitionState({
                      ...transitionState,
                      reason: e.target.value,
                    })
                  }
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmTransition}
                disabled={updateState.isPending}
              >
                {updateState.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transitioning...
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Confirm Transition
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

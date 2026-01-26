"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResolveDispute, type FinancialOperation } from "../hooks";
import type {
  DisputeResolutionOutcome,
  FinancialOperationType,
} from "@/dal/types";

const resolutionOutcomes: {
  value: DisputeResolutionOutcome;
  label: string;
}[] = [
  { value: "favor_renter", label: "Favor Renter" },
  { value: "favor_provider", label: "Favor Provider" },
  { value: "partial_renter", label: "Partial - Favor Renter" },
  { value: "partial_provider", label: "Partial - Favor Provider" },
  { value: "dismissed", label: "Dismissed" },
];

const resolveDisputeSchema = z.object({
  outcome: z.enum(
    [
      "favor_renter",
      "favor_provider",
      "partial_renter",
      "partial_provider",
      "dismissed",
    ],
    {
      message: "Please select a resolution outcome",
    },
  ),
  reason: z
    .string()
    .min(10, "Resolution reason must be at least 10 characters")
    .max(1000, "Resolution reason must be 1000 characters or less"),
  financialOperations: z
    .array(
      z.object({
        type: z.enum([
          "hold_payout",
          "refund_partial",
          "refund_full",
          "capture_deposit",
        ]),
        amount: z.number().positive().optional(),
      }),
    )
    .optional(),
});

type ResolveDisputeFormData = z.infer<typeof resolveDisputeSchema>;

interface AdminResolutionPanelProps {
  disputeId: string;
  currentStatus: string;
}

/**
 * Admin-only component for resolving disputes
 * Allows admins to set resolution outcome, reason, and financial operations
 */
export function AdminResolutionPanel({
  disputeId,
  currentStatus,
}: AdminResolutionPanelProps) {
  const [selectedOperations, setSelectedOperations] = useState<
    Set<FinancialOperationType>
  >(new Set());
  const [partialRefundAmount, setPartialRefundAmount] = useState<string>("");

  const resolveDispute = useResolveDispute(disputeId);

  const form = useForm<ResolveDisputeFormData>({
    resolver: zodResolver(resolveDisputeSchema),
    defaultValues: {
      outcome: undefined,
      reason: "",
      financialOperations: [],
    },
  });

  const handleOperationToggle = (type: FinancialOperationType) => {
    const newSelected = new Set(selectedOperations);
    if (newSelected.has(type)) {
      newSelected.delete(type);
      if (type === "refund_partial") {
        setPartialRefundAmount("");
      }
    } else {
      newSelected.add(type);
    }
    setSelectedOperations(newSelected);
  };

  const onSubmit = async (data: ResolveDisputeFormData) => {
    // Build financial operations array
    const financialOperations: FinancialOperation[] = [];

    selectedOperations.forEach((type) => {
      if (type === "refund_partial") {
        const amount = parseFloat(partialRefundAmount);
        if (amount > 0) {
          financialOperations.push({ type, amount });
        }
      } else {
        financialOperations.push({ type });
      }
    });

    await resolveDispute.mutateAsync({
      outcome: data.outcome,
      reason: data.reason,
      financialOperations:
        financialOperations.length > 0 ? financialOperations : undefined,
    });
  };

  // Only show if dispute is not already resolved or closed
  if (currentStatus === "resolved" || currentStatus === "closed") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Resolve Dispute
        </CardTitle>
        <CardDescription>
          Set the resolution outcome and execute any necessary financial
          operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Resolution Outcome */}
            <FormField
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Outcome</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resolutionOutcomes.map((outcome) => (
                        <SelectItem key={outcome.value} value={outcome.value}>
                          {outcome.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select how the dispute should be resolved
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Resolution Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain the resolution decision..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a detailed explanation for this resolution (10-1000
                    characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Financial Operations */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">
                  Financial Operations
                </Label>
                <p className="text-muted-foreground text-sm">
                  Select any financial operations to execute as part of this
                  resolution
                </p>
              </div>

              <div className="space-y-3">
                {/* Hold Payout */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="hold_payout"
                    checked={selectedOperations.has("hold_payout")}
                    onCheckedChange={() => handleOperationToggle("hold_payout")}
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="hold_payout"
                      className="flex cursor-pointer items-center gap-2 font-normal"
                    >
                      <DollarSign className="h-4 w-4" />
                      Hold Payout
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Prevent the provider from receiving payment for this
                      rental
                    </p>
                  </div>
                </div>

                {/* Full Refund */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="refund_full"
                    checked={selectedOperations.has("refund_full")}
                    onCheckedChange={() => handleOperationToggle("refund_full")}
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="refund_full"
                      className="flex cursor-pointer items-center gap-2 font-normal"
                    >
                      <DollarSign className="h-4 w-4" />
                      Full Refund
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Refund the full rental amount to the renter
                    </p>
                  </div>
                </div>

                {/* Partial Refund */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="refund_partial"
                    checked={selectedOperations.has("refund_partial")}
                    onCheckedChange={() =>
                      handleOperationToggle("refund_partial")
                    }
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="refund_partial"
                      className="flex cursor-pointer items-center gap-2 font-normal"
                    >
                      <DollarSign className="h-4 w-4" />
                      Partial Refund
                    </Label>
                    {selectedOperations.has("refund_partial") && (
                      <div className="mt-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Enter refund amount"
                          value={partialRefundAmount}
                          onChange={(e) =>
                            setPartialRefundAmount(e.target.value)
                          }
                          className="max-w-[200px]"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                          Enter the amount to refund (in dollars)
                        </p>
                      </div>
                    )}
                    <p className="text-muted-foreground text-sm">
                      Refund a partial amount to the renter
                    </p>
                  </div>
                </div>

                {/* Capture Deposit */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="capture_deposit"
                    checked={selectedOperations.has("capture_deposit")}
                    onCheckedChange={() =>
                      handleOperationToggle("capture_deposit")
                    }
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor="capture_deposit"
                      className="flex cursor-pointer items-center gap-2 font-normal"
                    >
                      <DollarSign className="h-4 w-4" />
                      Capture Security Deposit
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Capture the security deposit for the provider
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Alert */}
            {selectedOperations.has("refund_partial") &&
              (!partialRefundAmount ||
                parseFloat(partialRefundAmount) <= 0) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Please enter a valid refund amount for partial refund
                  </AlertDescription>
                </Alert>
              )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={resolveDispute.isPending}
                className="min-w-[120px]"
              >
                {resolveDispute.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Resolve Dispute
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

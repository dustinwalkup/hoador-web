"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCreateDispute } from "../hooks/use-create-dispute";
import type { DisputeReasonCode } from "@/dal/types";

const disputeReasonCodes: { value: DisputeReasonCode; label: string }[] = [
  { value: "damage", label: "Damage" },
  { value: "non_delivery", label: "Non-Delivery" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "cancellation", label: "Cancellation" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "other", label: "Other" },
];

const createDisputeSchema = z.object({
  reasonCode: z.enum(
    [
      "damage",
      "non_delivery",
      "quality_issue",
      "cancellation",
      "payment_issue",
      "other",
    ],
    {
      message: "Please select a reason for the dispute",
    },
  ),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be 2000 characters or less"),
});

type CreateDisputeFormData = z.infer<typeof createDisputeSchema>;

interface CreateDisputeFormProps {
  rentalId: string;
}

/**
 * Form content component (without Card wrapper)
 * Can be used in dialogs or other contexts
 */
export function CreateDisputeFormContent({ rentalId }: CreateDisputeFormProps) {
  const createDispute = useCreateDispute();

  const form = useForm<CreateDisputeFormData>({
    resolver: zodResolver(createDisputeSchema),
    defaultValues: {
      reasonCode: undefined,
      description: "",
    },
    mode: "onChange",
  });

  const onSubmit = async (data: CreateDisputeFormData) => {
    try {
      await createDispute.mutateAsync({
        rentalId,
        reasonCode: data.reasonCode,
        description: data.description,
      });
      // Navigation is handled by the hook's onSuccess callback
    } catch (error) {
      // Error is handled by the mutation hook's toast notification
      console.error("Failed to create dispute:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {createDispute.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {createDispute.error?.message ||
                "Failed to create dispute. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="reasonCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Dispute</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={createDispute.isPending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {disputeReasonCodes.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the primary reason for filing this dispute
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Please provide a detailed description of the issue..."
                  disabled={createDispute.isPending}
                  rows={6}
                  className="resize-none"
                />
              </FormControl>
              <FormDescription>
                Provide a clear and detailed description of the issue (10-2000
                characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={createDispute.isPending || !form.formState.isValid}
          >
            {createDispute.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "File Dispute"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Form component for creating a new dispute (with Card wrapper)
 * Accepts rentalId as prop and handles form validation and submission
 */
export function CreateDisputeForm({ rentalId }: CreateDisputeFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>File a Dispute</CardTitle>
        <CardDescription>
          Please provide details about the issue with this rental
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateDisputeFormContent rentalId={rentalId} />
      </CardContent>
    </Card>
  );
}

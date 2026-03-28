"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  EyeOff,
  XCircle,
} from "lucide-react";
import { z } from "zod";

import { ListingManageDialogShell } from "@/components/dashboard/listing-manage-dialog-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServiceListing } from "@/db/schemas/services.schema";
import {
  useDeactivateServiceListing,
  useDeleteServiceListing,
  useReactivateServiceListing,
} from "@/features/services/hooks/use-service-listings";

const serviceListingManagementSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

type ServiceListingManagementFormData = z.infer<
  typeof serviceListingManagementSchema
>;

interface ServiceListingManagementModalProps {
  listing: ServiceListing;
  trigger?: React.ReactNode;
}

function getStatusInfo(status: ServiceListing["status"]) {
  switch (status) {
    case "active":
      return {
        icon: CheckCircle,
        color:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        description: "Listing is visible in the marketplace",
        label: "Active",
      };
    case "inactive":
      return {
        icon: EyeOff,
        color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
        description: "Listing is hidden from the marketplace",
        label: "Inactive",
      };
    case "pending_approval":
      return {
        icon: Clock,
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
        description: "Listing is waiting for admin review",
        label: "Pending Review",
      };
    case "denied":
      return {
        icon: XCircle,
        color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        description: "Listing was denied and needs edits before resubmitting",
        label: "Denied",
      };
    default:
      return {
        icon: AlertTriangle,
        color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
        description: "Listing status unknown",
        label: "Unknown",
      };
  }
}

export function ServiceListingManagementModal({
  listing,
  trigger,
}: ServiceListingManagementModalProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const formId = `service-listing-manage-form-${listing.id}`;
  const deactivateMutation = useDeactivateServiceListing(listing.id);
  const reactivateMutation = useReactivateServiceListing(listing.id);
  const deleteMutation = useDeleteServiceListing(listing.id);

  const form = useForm<ServiceListingManagementFormData>({
    resolver: zodResolver(serviceListingManagementSchema),
    defaultValues: {
      status: listing.status === "inactive" ? "inactive" : "active",
    },
  });

  const currentStatus = form.watch("status");
  const statusInfo = getStatusInfo(
    listing.status === "active" || listing.status === "inactive"
      ? currentStatus
      : listing.status,
  );
  const StatusIcon = statusInfo.icon;
  const isManageable =
    listing.status === "active" || listing.status === "inactive";

  const handleSave = async (data: ServiceListingManagementFormData) => {
    setIsSaving(true);
    try {
      if (listing.status === "active" && data.status === "inactive") {
        await deactivateMutation.mutateAsync();
      } else if (listing.status === "inactive" && data.status === "active") {
        await reactivateMutation.mutateAsync();
      }
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
    setOpen(false);
  };

  return (
    <ListingManageDialogShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title="Manage listing"
      description={
        isManageable ? "Update listing status" : "Listing status management"
      }
      listingName={listing.title}
      statusDescription={statusInfo.description}
      statusIcon={StatusIcon}
      statusBadge={
        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
      }
      deleteConfig={{
        title: "Delete Listing",
        description:
          "Are you sure you want to delete this listing? This action cannot be undone and will permanently remove it.",
        buttonLabel: "Delete listing",
        pendingLabel: "Deleting...",
        isPending: deleteMutation.isPending,
        onConfirm: handleDelete,
      }}
      footerActions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {isManageable ? "Cancel" : "Close"}
          </Button>
          {isManageable ? (
            <Button
              type="submit"
              form={formId}
              disabled={
                isSaving ||
                deactivateMutation.isPending ||
                reactivateMutation.isPending
              }
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          ) : null}
        </div>
      }
    >
      {isManageable ? (
        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(handleSave)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Active
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4 text-gray-600" />
                          Inactive
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      ) : (
        <p className="text-muted-foreground text-sm">
          Status changes are not available while this listing is in the review
          workflow.
        </p>
      )}
    </ListingManageDialogShell>
  );
}

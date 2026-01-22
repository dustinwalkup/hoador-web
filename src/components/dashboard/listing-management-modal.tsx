"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Settings,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeleteListing } from "@/features/listings/hooks/use-garage";
import { toast } from "sonner";

const listingManagementSchema = z.object({
  status: z.enum(["available", "maintenance", "inactive"]),
});

type ListingManagementFormData = z.infer<typeof listingManagementSchema>;

interface ListingManagementModalProps {
  listing: {
    id: string;
    name: string;
    status: "available" | "rented" | "maintenance" | "inactive";
    isActive: boolean;
  };
  onSave: (data: ListingManagementFormData) => Promise<void>;
  trigger?: React.ReactNode;
  approvalStatus?: "pending_review" | "approved" | "rejected";
}

export default function ListingManagementModal({
  listing,
  onSave,
  trigger,
  approvalStatus,
}: ListingManagementModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteListingMutation = useDeleteListing();

  const form = useForm<ListingManagementFormData>({
    resolver: zodResolver(listingManagementSchema),
    defaultValues: {
      status: listing.status === "rented" ? "available" : listing.status,
    },
  });

  const onSubmit = async (data: ListingManagementFormData) => {
    setIsLoading(true);
    try {
      await onSave(data);
      setOpen(false);
    } catch (error) {
      console.error("Failed to save listing:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteListingMutation.mutateAsync(listing.id);
      toast.success("Listing deleted successfully");
      setOpen(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete listing";
      toast.error(errorMessage);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "available":
        return {
          icon: CheckCircle,
          color:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
          description: "Listing is available for rental",
        };
      case "rented":
        return {
          icon: Clock,
          color:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
          description: "Listing is currently rented out",
        };
      case "maintenance":
        return {
          icon: AlertTriangle,
          color:
            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
          description: "Listing is under maintenance",
        };
      case "inactive":
        return {
          icon: EyeOff,
          color:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
          description: "Listing is not available for rental",
        };
      default:
        return {
          icon: EyeOff,
          color:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
          description: "Listing status unknown",
        };
    }
  };

  const currentStatus = form.watch("status");
  const statusInfo = getStatusInfo(currentStatus);
  const StatusIcon = statusInfo.icon;
  const isApproved = !approvalStatus || approvalStatus === "approved";

  // If listing is currently rented, show a message instead of form
  if (listing.status === "rented") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || <Button variant="outline">Manage</Button>}
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage listing
            </DialogTitle>
            <DialogDescription>Listing status management</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <StatusIcon className="h-5 w-5" />
                <div>
                  <h3 className="font-medium">{listing.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {statusInfo.description}
                  </p>
                </div>
              </div>
              <Badge className={statusInfo.color}>
                {listing.status.charAt(0).toUpperCase() +
                  listing.status.slice(1)}
              </Badge>
            </div>

            <p className="text-muted-foreground text-center text-sm">
              This listing is currently rented out. Status changes are not
              available while the listing is in use.
            </p>
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>

              <div className="w-full border-t pt-4 sm:w-auto sm:border-t-0 sm:pt-0">
                {showDeleteConfirm ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-destructive text-sm font-medium">
                      Are you sure you want to delete this listing?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleteListingMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleteListingMutation.isPending}
                      >
                        {deleteListingMutation.isPending
                          ? "Deleting..."
                          : "Delete listing"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete listing
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Manage</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage listing
          </DialogTitle>
          <DialogDescription>Update listing status</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Status Display */}
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <StatusIcon className="h-5 w-5" />
                <div>
                  <h3 className="font-medium">{listing.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {statusInfo.description}
                  </p>
                </div>
              </div>
              <Badge className={statusInfo.color}>
                {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
              </Badge>
            </div>

            {/* Status Management */}
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-sm font-medium">
                Change Status
              </h3>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!isApproved}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Available
                          </div>
                        </SelectItem>
                        <SelectItem value="maintenance">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Maintenance
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
              {!isApproved && (
                <p className="text-muted-foreground text-sm">
                  Status changes are not available until the listing is
                  approved.
                </p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="w-full border-t pt-4 sm:w-auto sm:border-t-0 sm:pt-0">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading || deleteListingMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteListingMutation.isPending
                    ? "Deleting..."
                    : "Delete listing"}
                </Button>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading || !isApproved}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
            <AlertDialog
              open={showDeleteConfirm}
              onOpenChange={setShowDeleteConfirm}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <div className="rounded-full bg-red-100 p-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    Delete Listing
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    Are you sure you want to delete this Listing? This action
                    cannot be undone and will permanently remove the listing
                    from your inventory.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteListingMutation.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteListingMutation.isPending}
                  >
                    {deleteListingMutation.isPending
                      ? "Deleting..."
                      : "Delete Listing"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

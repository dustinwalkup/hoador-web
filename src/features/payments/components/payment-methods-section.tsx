"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  usePaymentMethods,
  useSetDefaultPaymentMethod,
  useDeletePaymentMethod,
  paymentKeys,
} from "../hooks/use-payment-methods";
import { PaymentMethodCard } from "./payment-method-card";
import { AddPaymentMethod } from ".";

/**
 * Payment methods section component
 * Displays saved payment methods and allows management
 */
export function PaymentMethodsSection() {
  const queryClient = useQueryClient();

  // React Query hooks
  const { data, isLoading, error } = usePaymentMethods();
  const paymentMethods = data?.paymentMethods ?? [];
  const defaultMethodId =
    data?.defaultPaymentMethodId &&
    paymentMethods.some((pm) => pm.id === data.defaultPaymentMethodId)
      ? data.defaultPaymentMethodId
      : null;
  const setDefaultMutation = useSetDefaultPaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<
    string | null
  >(null);

  const handleSetDefault = async (paymentMethodId: string) => {
    setSettingDefaultId(paymentMethodId);
    setDefaultMutation.mutate(paymentMethodId, {
      onSettled: () => {
        setSettingDefaultId(null);
      },
    });
  };

  const handleDelete = (paymentMethodId: string) => {
    setPaymentMethodToDelete(paymentMethodId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!paymentMethodToDelete) return;

    setDeletingId(paymentMethodToDelete);
    deleteMutation.mutate(paymentMethodToDelete, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setPaymentMethodToDelete(null);
        setDeletingId(null);
      },
      onError: () => {
        setDeletingId(null);
      },
    });
  };

  const handleAddSuccess = (paymentMethodId: string) => {
    // Set the new card as the default so it's used for future rentals
    setDefaultMutation.mutate(paymentMethodId);
    toast.success("Payment method added successfully");
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: paymentKeys.all });
  };

  if (showAddForm) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Add Payment Method</CardTitle>
              <CardDescription>Add a new card to your account</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AddPaymentMethod onSuccess={handleAddSuccess} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Manage your saved payment methods</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Add New Card
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 text-6xl">⚠️</div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              Failed to load payment methods
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted mb-4 rounded-full p-4">
              <CreditCard className="text-muted-foreground h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No payment methods</h3>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm">
              You haven&apos;t saved any payment methods yet. Add a card to get
              started.
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <PaymentMethodCard
                key={method.id}
                brand={method.brand}
                last4={method.last4}
                exp_month={method.exp_month}
                exp_year={method.exp_year}
                isDefault={defaultMethodId === method.id}
                isSettingDefault={settingDefaultId === method.id}
                isDeleting={deletingId === method.id}
                onSetDefault={() => handleSetDefault(method.id)}
                onDelete={() => handleDelete(method.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !deletingId) {
            setPaymentMethodToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? You
              won&apos;t be able to use it for future rentals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPaymentMethodToDelete(null);
              }}
              disabled={deletingId !== null}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

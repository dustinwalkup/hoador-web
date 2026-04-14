"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import type { CurrentDocumentVersion } from "@/dal/types";
import { type ListingDetails, type UserProfile } from "@/dal/types";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { useCreateRentalRequest } from "@/features/rentals/hooks/use-rental-mutations";
import {
  shouldOfferPushOnDevice,
  shouldShowPermissionPrompt,
} from "@/lib/pwa/use-push-permission";
import { PushPermissionPromptDialog } from "@/components/pwa/push-permission-prompt-dialog";
import {
  rentalFormSchema,
  type RentalFormData,
  validateDateRange,
} from "@/features/rentals/lib/rental-form.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { BackButton } from "@/components/back-button";
import { DateSelectionStep } from "@/features/rentals/components/rent-flow/date-selection-step";
import { ServicesStep } from "@/features/rentals/components/rent-flow/services-step";
import { SummaryStep } from "@/features/rentals/components/rent-flow/summary-step";
import { StepIndicator } from "@/features/rentals/components/rent-flow/step-indicator";
import { calculateServiceFee } from "@/constants/payments";
import { differenceInDays } from "@/lib/utils/date.utils";
import { ListingSummaryCard } from "@/features/rentals/components/rent-flow/listing-summary-card";

interface RentListingPageContentProps {
  listing: ListingDetails;
  bookedDates: Array<{ startDate: Date; endDate: Date; reason?: string }>;
  currentUser: UserProfile;
  legalDocuments: {
    rentalAgreement?: CurrentDocumentVersion;
    cancellationRefund?: CurrentDocumentVersion;
    safetyLiabilityPackage?: CurrentDocumentVersion;
    paymentPayout?: CurrentDocumentVersion;
  };
}

type BookingStep = "dates" | "delivery" | "payment" | "summary";

export function RentListingPageContent({
  listing,
  bookedDates,
  currentUser,
  legalDocuments,
}: RentListingPageContentProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingStep>("dates");
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pendingRedirectRequestId, setPendingRedirectRequestId] = useState<
    string | null
  >(null);
  const createRentalMutation = useCreateRentalRequest();

  const form = useForm<RentalFormData>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: {
      deliveryMethod: "pickup",
      deliveryStreet: currentUser.primaryAddress?.street || "",
      deliveryCity: currentUser.primaryAddress?.city || "",
      deliveryState: currentUser.primaryAddress?.state || "",
      deliveryZip: currentUser.primaryAddress?.zipCode || "",
      deliveryInstructions: "",
      setupRequested: false,
      message: "",
      paymentMethodId: "",
      // Legal document acknowledgements - default to false
      rentalAgreementAccepted: false,
      cancellationRefundAcknowledged: false,
      safetyLiabilityPackageAccepted: false,
      paymentPayoutAccepted: false,
    },
    mode: "onTouched",
  }) as ReturnType<typeof useForm<RentalFormData>>;

  const {
    control,
    trigger,
    formState: { isSubmitting },
    setValue,
    handleSubmit,
  } = form;

  const watchedValues = useWatch({ control });

  const calculateTotal = () => {
    if (!watchedValues.startDate || !watchedValues.endDate)
      return {
        days: 0,
        subtotal: 0,
        deliveryFee: 0,
        setupFee: 0,
        serviceFee: 0,
        securityDeposit: 0,
        total: 0,
      };

    const days =
      differenceInDays(watchedValues.endDate, watchedValues.startDate) + 1;
    const rate = listing.dailyRate;

    // Apply weekly/monthly discounts — temporarily disabled (daily rate only)
    // if (days >= 30 && listing.monthlyRate) {
    //   rate = listing.monthlyRate / 30;
    // } else if (days >= 7 && listing.weeklyRate) {
    //   rate = listing.weeklyRate / 7;
    // }

    const subtotal = Math.round(rate * days * 100) / 100;
    const deliveryFeeAmount =
      watchedValues.deliveryMethod === "delivery" ? listing.deliveryFee : 0;
    const setupFeeAmount =
      watchedValues.setupRequested &&
      watchedValues.deliveryMethod === "delivery"
        ? listing.setupFee
        : 0;
    const rentalCharges = subtotal + deliveryFeeAmount + setupFeeAmount;
    const serviceFee = calculateServiceFee(rentalCharges);
    const securityDeposit = listing.securityDeposit;
    const total = subtotal + deliveryFeeAmount + setupFeeAmount + serviceFee;

    return {
      days,
      subtotal,
      deliveryFee: deliveryFeeAmount,
      setupFee: setupFeeAmount,
      serviceFee,
      securityDeposit,
      total,
    };
  };

  const handleNext = async () => {
    switch (currentStep) {
      case "dates": {
        const isValid = await trigger(["startDate", "endDate"]);
        if (!isValid) return;

        // Additional validation for date range constraints
        const dateValidation = validateDateRange(
          watchedValues.startDate,
          watchedValues.endDate,
          listing.minimumRentalPeriod,
          listing.maximumRentalPeriod,
        );

        if (!dateValidation.isValid) {
          toast.error("Invalid Date Range", {
            description: dateValidation.error,
          });
          return;
        }

        setCurrentStep("delivery");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      }
      case "delivery": {
        const isValid = await trigger([
          "deliveryMethod",
          "deliveryStreet",
          "deliveryCity",
          "deliveryState",
          "deliveryZip",
          "deliveryInstructions",
          "setupRequested",
        ]);
        if (isValid) {
          setCurrentStep("payment");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        break;
      }
      case "payment":
        setCurrentStep("summary");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "summary":
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "delivery":
        setCurrentStep("dates");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "payment":
        setCurrentStep("delivery");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "summary":
        setCurrentStep("payment");
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "dates":
        // Don't go back from the first step
        break;
    }
  };

  const handlePaymentSuccess = async (methodId: string) => {
    setValue("paymentMethodId", methodId);
    setCurrentStep("summary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: RentalFormData) => {
    // Validate dates are present (they should be at this point)
    if (!data.startDate || !data.endDate) {
      toast.error("Invalid Date Range", {
        description: "Please select both start and end dates",
      });
      return;
    }

    // Validate all policies are accepted (single checkbox sets all fields)
    if (!data.rentalAgreementAccepted) {
      toast.error("Legal Agreement Required", {
        description:
          "You must accept the Rental Agreement and all policies to continue",
      });
      return;
    }

    if (!data.paymentMethodId?.trim()) {
      toast.error("Payment method required", {
        description: "Please select a payment method.",
      });
      return;
    }

    // Concatenate address fields into a single string for navigation
    const fullAddress =
      data.deliveryMethod === "delivery"
        ? `${data.deliveryStreet}, ${data.deliveryCity}, ${data.deliveryState} ${data.deliveryZip}`
        : undefined;

    try {
      const result = await createRentalMutation.mutateAsync({
        listingId: listing.id,
        startDate: data.startDate,
        endDate: data.endDate,
        deliveryRequested: data.deliveryMethod === "delivery",
        deliveryAddress: fullAddress,
        deliveryInstructions:
          data.deliveryMethod === "delivery" &&
          data.deliveryInstructions?.trim()
            ? data.deliveryInstructions.trim()
            : undefined,
        setupRequested:
          data.setupRequested && data.deliveryMethod === "delivery",
        setupFee:
          data.setupRequested && data.deliveryMethod === "delivery"
            ? listing.setupFee
            : 0,
        message: data.message || undefined,
        paymentMethodId: data.paymentMethodId.trim(),
        // Legal document acknowledgements
        rentalAgreementAccepted: data.rentalAgreementAccepted,
        cancellationRefundAcknowledged:
          data.cancellationRefundAcknowledged || false,
        safetyLiabilityPackageAccepted:
          data.safetyLiabilityPackageAccepted || false,
        paymentPayoutAccepted: data.paymentPayoutAccepted || false,
      });

      // Success toast is handled by the mutation hook
      if (result.requestId) {
        if (shouldOfferPushOnDevice() && shouldShowPermissionPrompt()) {
          setPendingRedirectRequestId(result.requestId);
          setShowPushPrompt(true);
        } else {
          router.push(`/dashboard/rental/${result.requestId}?view=renting`);
        }
      }
    } catch {
      // Error toast is already shown by the mutation hook
    }
  };

  const handlePushPromptComplete = (enabled: boolean) => {
    const requestId = pendingRedirectRequestId;
    setPendingRedirectRequestId(null);
    if (requestId) {
      router.push(`/dashboard/rental/${requestId}?view=renting`);
    }
    if (enabled) {
      toast.success("Push notifications enabled");
    }
  };

  const pricing = calculateTotal();

  const canProceed = () => {
    switch (currentStep) {
      case "dates": {
        const dateValidation = validateDateRange(
          watchedValues.startDate,
          watchedValues.endDate,
          listing.minimumRentalPeriod,
          listing.maximumRentalPeriod,
        );
        return dateValidation.isValid;
      }
      case "delivery": {
        // Check if delivery method is pickup or all delivery fields are filled
        if (watchedValues.deliveryMethod === "pickup") return true;
        return !!(
          watchedValues.deliveryStreet?.trim() &&
          watchedValues.deliveryCity?.trim() &&
          watchedValues.deliveryState?.trim() &&
          watchedValues.deliveryZip?.trim()
        );
      }
      case "summary":
        return true;
      case "payment":
        return false; // Payment is handled by PaymentForm component
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "dates":
        return "Select Rental Dates";
      case "delivery":
        return "Services & Delivery";
      case "summary":
        return "Review request";
      case "payment":
        return "Payment Details";
      default:
        return "Request a rental";
    }
  };

  return (
    <Form {...form}>
      <PushPermissionPromptDialog
        open={showPushPrompt}
        onOpenChange={setShowPushPrompt}
        onComplete={handlePushPromptComplete}
        title="Get notified when the owner responds"
        description="Enable push notifications to hear when your rental request is approved or if the owner has questions."
      />
      <div className="min-h-screen">
        <div className="container mx-auto">
          {/* Header */}
          <div className="flex w-full justify-center">
            <div className="mb-6 flex w-full max-w-4xl flex-col items-start justify-between md:flex-row md:items-center">
              <BackButton className="md:mb-0!" />
              <StepIndicator currentStep={currentStep} />
            </div>
          </div>

          <div className="mx-auto max-w-4xl">
            <h1 className="mb-8 text-3xl font-bold">{getStepTitle()}</h1>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <Card className="pt-0">
                  <CardContent className="p-4">
                    {/* Step 1: Date Selection */}
                    {currentStep === "dates" && (
                      <DateSelectionStep
                        minimumRentalPeriod={listing.minimumRentalPeriod}
                        maximumRentalPeriod={listing.maximumRentalPeriod}
                        days={pricing.days}
                        bookedDates={bookedDates}
                      />
                    )}

                    {/* Step 2: Services & Delivery */}
                    {currentStep === "delivery" && (
                      <ServicesStep
                        ownerName={`${listing.owner.firstName} ${listing.owner.lastName}`}
                        deliveryMode={listing.deliveryMode}
                        deliveryFee={listing.deliveryFee}
                        deliveryRadius={listing.deliveryRadius}
                        setupAvailable={listing.setupAvailable}
                        setupFee={listing.setupFee}
                      />
                    )}

                    {/* Step 3: Payment */}
                    {currentStep === "payment" && (
                      <div className="space-y-6">
                        <div className="mb-4">
                          <h3 className="mb-2 text-lg font-medium">
                            Confirm Payment Method
                          </h3>
                          <p className="text-gray-600">
                            Your payment method is stored securely by Stripe.
                            Payment will only be processed after{" "}
                            {listing.owner.firstName} approves your rental
                            request.
                          </p>
                        </div>
                        <PaymentForm onSuccess={handlePaymentSuccess} />
                      </div>
                    )}

                    {/* Step 4: Summary */}
                    {currentStep === "summary" && (
                      <SummaryStep
                        pricing={pricing}
                        legalDocuments={legalDocuments}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - Listing Summary */}
              <div className="space-y-4">
                <ListingSummaryCard listing={listing} pricing={pricing} />

                {currentStep !== "payment" && (
                  <Button
                    type="button"
                    onClick={
                      currentStep === "summary"
                        ? handleSubmit(onSubmit)
                        : handleNext
                    }
                    className="bg-primary hover:bg-primary/90 w-full"
                    size="lg"
                    disabled={
                      !canProceed() ||
                      isSubmitting ||
                      (currentStep === "summary" &&
                        !watchedValues.paymentMethodId?.trim())
                    }
                  >
                    {isSubmitting
                      ? "Sending request..."
                      : currentStep === "summary"
                        ? "Request booking"
                        : "Continue"}
                  </Button>
                )}

                {/* Back button - show on all steps except the first */}
                {currentStep !== "dates" && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}

                {currentStep !== "summary" && currentStep !== "payment" && (
                  <p className="text-center text-xs text-gray-600">
                    Payment will be processed after the owner approves your
                    request
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}

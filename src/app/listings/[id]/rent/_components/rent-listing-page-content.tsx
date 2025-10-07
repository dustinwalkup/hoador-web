"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";

import { PaymentForm } from "@/features/payments/components/payment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { type ListingDetails } from "@/dal/types";
import { createRentalRequest } from "@/features/rentals/actions/create-rental-request";
import { DateSelectionStep } from "./date-selection-step";
import { DeliveryMethodStep } from "./delivery-method-step";
import { TimeWindowStep } from "./time-window-step";
import { SummaryStep } from "./summary-step";
import { StepIndicator } from "./step-indicator";
import { differenceInDays } from "@/lib/utils/date.utils";
import { ListingSummaryCard } from "./listing-summary-card";

interface RentListingPageContentProps {
  listing: ListingDetails;
}

type BookingStep = "dates" | "delivery" | "windows" | "payment" | "summary";

// Mock time windows (in a real app, these could come from the listing owner's availability)
const timeWindows = {
  pickup: [
    { id: "morning", label: "Morning (9:00 AM - 12:00 PM)", available: true },
    {
      id: "afternoon",
      label: "Afternoon (1:00 PM - 5:00 PM)",
      available: true,
    },
    { id: "evening", label: "Evening (6:00 PM - 8:00 PM)", available: false },
  ],
  delivery: [
    { id: "morning", label: "Morning (9:00 AM - 12:00 PM)", available: true },
    {
      id: "afternoon",
      label: "Afternoon (1:00 PM - 5:00 PM)",
      available: true,
    },
  ],
};

export function RentListingPageContent({
  listing,
}: RentListingPageContentProps) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<BookingStep>("dates");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedWindow, setSelectedWindow] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");

  const calculateTotal = () => {
    if (!dateRange?.from || !dateRange?.to)
      return {
        days: 0,
        subtotal: 0,
        deliveryFee: 0,
        securityDeposit: 0,
        total: 0,
      };

    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    let rate = listing.dailyRate;

    // Apply weekly/monthly discounts
    if (days >= 30 && listing.monthlyRate) {
      rate = listing.monthlyRate / 30;
    } else if (days >= 7 && listing.weeklyRate) {
      rate = listing.weeklyRate / 7;
    }

    const subtotal = Math.round(rate * days * 100) / 100;
    const deliveryFeeAmount =
      deliveryMethod === "delivery" ? listing.deliveryFee : 0;
    const securityDeposit = listing.securityDeposit;
    const total = subtotal + deliveryFeeAmount + securityDeposit;

    return {
      days,
      subtotal,
      deliveryFee: deliveryFeeAmount,
      securityDeposit,
      total,
    };
  };

  const handleNext = () => {
    switch (currentStep) {
      case "dates":
        if (dateRange?.from && dateRange?.to) {
          setCurrentStep("delivery");
        }
        break;
      case "delivery":
        setCurrentStep("windows");
        break;
      case "windows":
        if (selectedWindow) {
          setCurrentStep("payment");
        }
        break;
      case "payment":
        setCurrentStep("summary");
        break;
      case "summary":
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "delivery":
        setCurrentStep("dates");
        break;
      case "windows":
        setCurrentStep("delivery");
        break;
      case "payment":
        setCurrentStep("windows");
        break;
      case "summary":
        setCurrentStep("payment");
        break;
      case "dates":
        // Don't go back from the first step
        break;
    }
  };

  const handlePaymentSuccess = async (methodId: string) => {
    setPaymentMethodId(methodId);
    setCurrentStep("summary");
  };

  const handleCreateRentalRequest = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsSubmitting(true);

    try {
      const result = await createRentalRequest({
        listingId: listing.id,
        startDate: dateRange.from,
        endDate: dateRange.to,
        deliveryRequested: deliveryMethod === "delivery",
        deliveryAddress:
          deliveryMethod === "delivery" ? deliveryAddress : undefined,
        selectedWindow,
        message: message || undefined,
        paymentMethodId,
      });

      if (result.success) {
        // Redirect to the confirmation page with the request ID
        router.push(`/dashboard/rental/${result.requestId}?view=renting`);
      } else {
        // Handle error
        console.error("Rental request failed:", result.error);
        alert(result.error || "Failed to submit rental request");
      }
    } catch (error) {
      console.error("Error submitting rental request:", error);
      alert("Failed to submit rental request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pricing = calculateTotal();

  // Validation helper for date range
  const isDateRangeValid = () => {
    if (!dateRange?.from || !dateRange?.to) return false;

    const selectedDays = differenceInDays(dateRange.to, dateRange.from) + 1;
    return (
      selectedDays >= listing.minimumRentalPeriod &&
      selectedDays <= listing.maximumRentalPeriod
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case "dates":
        return dateRange?.from && dateRange?.to && isDateRangeValid();
      case "delivery":
        return (
          deliveryMethod === "pickup" ||
          (deliveryMethod === "delivery" && deliveryAddress.trim())
        );
      case "windows":
        return selectedWindow;
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
        return "Pickup or Delivery?";
      case "windows":
        return `Select ${deliveryMethod === "pickup" ? "Pickup" : "Delivery"} Window`;
      case "summary":
        return "Confirm Booking";
      case "payment":
        return "Payment Details";
      default:
        return "Book Rental";
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-start justify-between md:flex-row md:items-center">
          <BackButton className="md:mb-0!" />
          <StepIndicator currentStep={currentStep} />
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
                      dateRange={dateRange}
                      setDateRange={setDateRange}
                      minimumRentalPeriod={listing.minimumRentalPeriod}
                      maximumRentalPeriod={listing.maximumRentalPeriod}
                      days={pricing.days}
                    />
                  )}

                  {/* Step 2: Delivery Method */}
                  {currentStep === "delivery" && (
                    <DeliveryMethodStep
                      deliveryMethod={deliveryMethod}
                      setDeliveryMethod={setDeliveryMethod}
                      deliveryAddress={deliveryAddress}
                      setDeliveryAddress={setDeliveryAddress}
                      ownerName={`${listing.owner.firstName} ${listing.owner.lastName}`}
                      deliveryMode={listing.deliveryMode}
                      deliveryFee={listing.deliveryFee}
                      deliveryRadius={listing.deliveryRadius}
                    />
                  )}

                  {/* Step 3: Time Windows */}
                  {currentStep === "windows" && (
                    <TimeWindowStep
                      deliveryMethod={deliveryMethod}
                      selectedWindow={selectedWindow}
                      setSelectedWindow={setSelectedWindow}
                      timeWindows={timeWindows}
                    />
                  )}

                  {/* Step 4: Payment */}
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

                  {/* Step 5: Summary */}
                  {currentStep === "summary" && (
                    <SummaryStep
                      dateRange={dateRange}
                      deliveryMethod={deliveryMethod}
                      deliveryAddress={deliveryAddress}
                      selectedWindow={selectedWindow}
                      message={message}
                      setMessage={setMessage}
                      pricing={pricing}
                      timeWindows={timeWindows}
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Listing Summary */}
            <div className="space-y-6">
              <ListingSummaryCard listing={listing} pricing={pricing} />

              {currentStep !== "payment" && (
                <Button
                  onClick={
                    currentStep === "summary"
                      ? handleCreateRentalRequest
                      : handleNext
                  }
                  className="bg-primary hover:bg-primary/90 w-full"
                  size="lg"
                  disabled={!canProceed() || isSubmitting}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : currentStep === "summary"
                      ? "Send Request"
                      : "Continue"}
                </Button>
              )}

              {/* Back button - show on all steps except the first */}
              {currentStep !== "dates" && (
                <Button
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
  );
}

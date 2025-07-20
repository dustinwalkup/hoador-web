"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { differenceInDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { type ToolDetails } from "@/lib/dal/types";
import { createRentalRequest } from "@/lib/actions/create-rental-request";
import { DateSelectionStep } from "./date-selection-step";
import { DeliveryMethodStep } from "./delivery-method-step";
import { TimeWindowStep } from "./time-window-step";
import { SummaryStep } from "./summary-step";
import { StepIndicator } from "./step-indicator";
import { ToolSummaryCard } from "./tool-summary-card";

interface RentToolPageContentProps {
  tool: ToolDetails;
}

type BookingStep = "dates" | "delivery" | "windows" | "summary";

// Mock time windows (in a real app, these could come from the tool owner's availability)
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

export function RentToolPageContent({ tool }: RentToolPageContentProps) {
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
    let rate = tool.dailyRate;

    // Apply weekly/monthly discounts
    if (days >= 30 && tool.monthlyRate) {
      rate = tool.monthlyRate / 30;
    } else if (days >= 7 && tool.weeklyRate) {
      rate = tool.weeklyRate / 7;
    }

    const subtotal = Math.round(rate * days * 100) / 100;
    const deliveryFeeAmount =
      deliveryMethod === "delivery" ? tool.deliveryFee : 0;
    const securityDeposit = tool.securityDeposit;
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
          setCurrentStep("summary");
        }
        break;
      case "summary":
        handleSubmit();
        break;
    }
  };

  const handleSubmit = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsSubmitting(true);

    try {
      const result = await createRentalRequest({
        toolId: tool.id,
        startDate: dateRange.from,
        endDate: dateRange.to,
        deliveryRequested: deliveryMethod === "delivery",
        deliveryAddress:
          deliveryMethod === "delivery" ? deliveryAddress : undefined,
        selectedWindow,
        message: message || undefined,
      });

      if (result.success) {
        // Redirect to the confirmation page with the request ID
        router.push(`/dashboard/confirmation?requestId=${result.requestId}`);
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
  const canProceed = () => {
    switch (currentStep) {
      case "dates":
        return dateRange?.from && dateRange?.to;
      case "delivery":
        return (
          deliveryMethod === "pickup" ||
          (deliveryMethod === "delivery" && deliveryAddress.trim())
        );
      case "windows":
        return selectedWindow;
      case "summary":
        return true;
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
      default:
        return "Book Rental";
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <BackButton />
          <StepIndicator currentStep={currentStep} />
        </div>

        <div className="mx-auto max-w-4xl">
          <h1 className="mb-8 text-3xl font-bold">{getStepTitle()}</h1>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6">
                  {/* Step 1: Date Selection */}
                  {currentStep === "dates" && (
                    <DateSelectionStep
                      dateRange={dateRange}
                      setDateRange={setDateRange}
                      minimumRentalPeriod={tool.minimumRentalPeriod}
                      maximumRentalPeriod={tool.maximumRentalPeriod}
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
                      ownerName={`${tool.owner.firstName} ${tool.owner.lastName}`}
                      deliveryAvailable={tool.deliveryAvailable}
                      deliveryFee={tool.deliveryFee}
                      deliveryRadius={tool.deliveryRadius}
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

                  {/* Step 4: Summary */}
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

            {/* Sidebar - Tool Summary */}
            <div className="space-y-6">
              <ToolSummaryCard tool={tool} pricing={pricing} />

              <Button
                onClick={handleNext}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting
                  ? "Submitting..."
                  : currentStep === "summary"
                    ? "Send Request"
                    : "Continue"}
              </Button>

              {currentStep !== "summary" && (
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

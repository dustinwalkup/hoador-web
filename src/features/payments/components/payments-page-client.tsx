"use client";

import type { RentalPayment, PaginatedResult } from "@/dal/types";
import { PaymentMethodsSection } from "./payment-methods-section";
import { RenterSection } from "./renter-section";
import { PaymentExplainerSection } from "./payment-explainer-section";

interface PaymentsPageClientProps {
  paymentHistory: RentalPayment[];
  pagination: PaginatedResult<RentalPayment>["pagination"];
  currentPage: number;
}

/**
 * Client component for the payments page
 * Displays payment methods and payment history
 */
export function PaymentsPageClient({
  paymentHistory,
  pagination,
  currentPage,
}: PaymentsPageClientProps) {
  return (
    <div className="space-y-8">
      <PaymentMethodsSection />
      <RenterSection
        paymentHistory={paymentHistory}
        pagination={pagination}
        currentPage={currentPage}
      />
      <PaymentExplainerSection activeTab="renter" />
    </div>
  );
}

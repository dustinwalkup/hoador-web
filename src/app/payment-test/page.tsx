"use client";

import { PaymentForm } from "@/features/payments/components/payment-form";

const AMOUNT = 49.99;

export default function PaymentTest() {
  return <PaymentForm amount={AMOUNT} />;
}

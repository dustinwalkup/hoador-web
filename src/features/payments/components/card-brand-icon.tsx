import * as React from "react";
import { PaymentIcon } from "react-svg-credit-card-payment-icons";
import { normalizeCardBrand } from "@/features/payments/utils/card-brand";
import { GenericCardIcon } from "./generic";

interface CardBrandIconProps {
  brand: string;
  className?: string;
  size?: number;
}

/**
 * Valid PaymentIcon type values (PascalCase as required by the library)
 */
type PaymentIconType =
  | "Visa"
  | "Mastercard"
  | "Amex"
  | "Discover"
  | "Diners"
  | "Jcb"
  | "Unionpay"
  | "Elo";

/**
 * Maps Stripe brand values to PaymentIcon type values
 */
function mapBrandToPaymentIconType(brand: string): PaymentIconType | "generic" {
  const normalized = normalizeCardBrand(brand);

  const brandMap: Record<string, PaymentIconType> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    diners: "Diners",
    jcb: "Jcb",
    unionpay: "Unionpay",
    elo: "Elo",
  };

  return brandMap[normalized] || "generic";
}

/**
 * Card brand icon component
 * Uses professional SVG icons from react-svg-credit-card-payment-icons
 */
export function CardBrandIcon({
  brand,
  className,
  size = 40,
}: CardBrandIconProps) {
  const iconType = mapBrandToPaymentIconType(brand);

  // Use the PaymentIcon component with 'logo' format for professional appearance
  if (iconType !== "generic") {
    return (
      <PaymentIcon
        type={iconType}
        format="logo"
        width={size}
        className={className}
      />
    );
  }

  // Fallback to generic icon for unknown brands
  return (
    <GenericCardIcon
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

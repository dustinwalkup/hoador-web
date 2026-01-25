"use client";

import { Trash2, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardBrandIcon } from "@/features/payments/components/card-brand-icon";
import {
  getCardBrandDisplayName,
  getCardBrandBgColor,
} from "@/features/payments/utils/card-brand";

interface PaymentMethodCardProps {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault: boolean;
  isSettingDefault: boolean;
  isDeleting: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
}

/**
 * Format expiration date
 */
function formatExpiration(month: number, year: number): string {
  return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
}

/**
 * Individual payment method card component
 * Displays card with brand icon, details, and actions
 */
export function PaymentMethodCard({
  brand,
  last4,
  exp_month,
  exp_year,
  isDefault,
  isSettingDefault,
  isDeleting,
  onSetDefault,
  onDelete,
}: PaymentMethodCardProps) {
  const brandDisplayName = getCardBrandDisplayName(brand);
  const brandBgColor = getCardBrandBgColor(brand);
  const expiration = formatExpiration(exp_month, exp_year);

  return (
    <div className="group bg-card relative overflow-hidden rounded-lg border transition-all duration-200 hover:shadow-md">
      {/* Brand color accent bar */}
      <div className={`h-1 ${brandBgColor}`} />

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Icon and card details */}
        <div className="flex items-center gap-4">
          {/* Brand icon */}
          <div className="shrink-0">
            <CardBrandIcon brand={brand} size={48} className="rounded" />
          </div>

          {/* Card details */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {brandDisplayName} •••• {last4}
              </span>
              {isDefault && (
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary text-xs font-medium"
                >
                  Default
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground text-sm">
              Expires {expiration}
            </div>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetDefault}
              disabled={isSettingDefault}
              title="Set as default"
              className="h-8 w-8 p-0"
            >
              {isSettingDefault ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            title="Remove payment method"
            className="text-destructive hover:text-destructive h-8 w-8 p-0"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

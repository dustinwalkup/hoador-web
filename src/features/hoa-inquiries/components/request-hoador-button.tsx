"use client";

import { Button } from "@/components/ui/button";
import { RequestHoadorModal } from "./request-hoador-modal";
import type { ButtonVariantsType } from "@/components/ui/button";

interface RequestHoadorButtonProps {
  label?: string;
  variant?: ButtonVariantsType;
  className?: string;
}

export function RequestHoadorButton({
  label = "Request Hoador for Your Community",
  variant = "default",
  className = "rounded-full",
}: RequestHoadorButtonProps) {
  return (
    <RequestHoadorModal
      trigger={
        <Button size="lg" variant={variant} className={className}>
          {label}
        </Button>
      }
    />
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface ServiceListingDeactivateButtonProps {
  listingId: string;
  disabled?: boolean;
}

/**
 * POST /api/services/listings/[id]/deactivate
 */
export function ServiceListingDeactivateButton({
  listingId,
  disabled,
}: ServiceListingDeactivateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDeactivate() {
    if (
      !confirm("Deactivate this listing? It will no longer appear in search.")
    ) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/services/listings/${listingId}/deactivate`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not deactivate");
        return;
      }
      toast.success("Listing deactivated.");
      router.push("/dashboard/services");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={disabled || pending}
      onClick={onDeactivate}
    >
      {pending ? "Deactivating…" : "Deactivate listing"}
    </Button>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { calculateServiceFee } from "@/constants/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceListing } from "@/db/schemas/services.schema";
import { formatServiceUsd } from "@/features/services/lib/service-labels";

interface ServiceBookingFlowProps {
  listingId: string;
  listing: Pick<ServiceListing, "pricingType" | "price" | "title">;
}

/**
 * Three-step booking request: details → price summary → submit.
 */
export function ServiceBookingFlow({
  listingId,
  listing,
}: ServiceBookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("09:00");
  const [hours, setHours] = useState("1");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const priceNum = Number.parseFloat(String(listing.price));
  const hourly = listing.pricingType === "hourly";
  const hoursNum = hourly ? Number.parseFloat(hours) : 1;

  const { servicePrice, serviceFee, total } = useMemo(() => {
    const sp = hourly
      ? Number.isFinite(priceNum) && Number.isFinite(hoursNum)
        ? Math.round(priceNum * hoursNum * 100) / 100
        : 0
      : Number.isFinite(priceNum)
        ? priceNum
        : 0;
    const fee = calculateServiceFee(sp);
    const t = Math.round((sp + fee) * 100) / 100;
    return { servicePrice: sp, serviceFee: fee, total: t };
  }, [hourly, priceNum, hoursNum]);

  function validateStep1(): boolean {
    if (!proposedDate || !proposedTime) {
      toast.error("Choose a date and time.");
      return false;
    }
    if (hourly && (!Number.isFinite(hoursNum) || hoursNum <= 0)) {
      toast.error("Enter hours for hourly pricing.");
      return false;
    }
    return true;
  }

  async function submit() {
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        listingId,
        proposedDate,
        proposedTime,
        notes: notes.trim() || null,
      };
      if (hourly) {
        body.hours = hoursNum;
      }
      const res = await fetch("/api/services/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not create booking");
        return;
      }
      const bookingId = data.bookingId as string;
      router.push(`/dashboard/services/bookings/${bookingId}?new=1`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-muted-foreground flex gap-2 text-sm">
        <span className={step >= 1 ? "text-foreground font-medium" : ""}>
          1. Details
        </span>
        <span>→</span>
        <span className={step >= 2 ? "text-foreground font-medium" : ""}>
          2. Summary
        </span>
        <span>→</span>
        <span className={step >= 3 ? "text-foreground font-medium" : ""}>
          3. Confirm
        </span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Proposed date</Label>
            <Input
              id="date"
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="time">Proposed time</Label>
            <Input
              id="time"
              type="time"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              required
            />
          </div>
          {hourly ? (
            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="notes">Notes to provider (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Price summary</h2>
          <div className="bg-muted/40 space-y-2 rounded-md border p-4 text-sm">
            <div className="flex justify-between">
              <span>Service price</span>
              <span>{formatServiceUsd(servicePrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs">Service fee</span>
              <span>{formatServiceUsd(serviceFee)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatServiceUsd(total)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm">
            You are requesting <strong>{listing.title}</strong> on{" "}
            <strong>{proposedDate}</strong> at <strong>{proposedTime}</strong>.
          </p>
          <p className="text-muted-foreground text-sm">
            Total estimated charge: <strong>{formatServiceUsd(total)}</strong>{" "}
            (charged when the provider accepts).
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Submitting…" : "Confirm request"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

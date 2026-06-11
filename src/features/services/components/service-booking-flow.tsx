"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Timer,
  FileText,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";
import { ServiceFeeLine } from "@/components/payments/service-fee-line";
import { calculateServiceFee } from "@/constants/payments";
import {
  createServiceBookingFormSchema,
  type ServiceBookingFormValues,
} from "@/features/services/lib/service-booking-form.schema";
import {
  ServiceLegalDisclosures,
  type ServiceLegalDocuments,
} from "@/features/services/components/service-legal-disclosures";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface ListingInfo {
  id: string;
  pricingType: "hourly" | "fixed";
  price: number;
  title: string;
  provider: {
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
}

interface ServiceBookingFlowProps {
  listing: ListingInfo;
  paymentMethods: PaymentMethod[];
  addPaymentMethodHref: string;
  bookingSuccessHref: string;
  legalDocuments: ServiceLegalDocuments;
  /** Set to true if price is in cents (will divide by 100) */
  priceInCents?: boolean;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

type Step = 1 | 2 | 3;

const steps = [
  { id: 1, label: "Details", icon: CalendarDays },
  { id: 2, label: "Summary", icon: FileText },
  { id: 3, label: "Confirm", icon: CheckCircle2 },
] as const;

function defaultPaymentMethodId(methods: PaymentMethod[]): string {
  return methods.find((pm) => pm.isDefault)?.id ?? methods[0]?.id ?? "";
}

/**
 * Modern three-step booking request flow.
 * Clean design with visual step indicators and clear pricing breakdown.
 */
export function ServiceBookingFlow({
  listing,
  paymentMethods,
  addPaymentMethodHref,
  bookingSuccessHref,
  legalDocuments,
  priceInCents = true,
}: ServiceBookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [pending, setPending] = useState(false);

  const priceInDollars = priceInCents ? listing.price / 100 : listing.price;
  const isHourly = listing.pricingType === "hourly";

  const bookingSchema = useMemo(
    () => createServiceBookingFormSchema(isHourly),
    [isHourly],
  );

  const form = useForm<ServiceBookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      proposedDate: "",
      proposedTime: "09:00",
      hours: "1",
      notes: "",
      paymentMethodId: defaultPaymentMethodId(paymentMethods),
      serviceAgreementAccepted: false,
      cancellationRefundAcknowledged: false,
      safetyLiabilityAccepted: false,
      paymentPayoutAccepted: false,
      platformTermsAccepted: false,
    },
    mode: "onTouched",
  });

  const { control, trigger, handleSubmit } = form;

  const proposedDate = useWatch({ control, name: "proposedDate" }) ?? "";
  const proposedTime = useWatch({ control, name: "proposedTime" }) ?? "";
  const hours = useWatch({ control, name: "hours" }) ?? "";
  const notes = useWatch({ control, name: "notes" }) ?? "";

  const hoursNum = isHourly ? Number.parseFloat(String(hours)) : 1;

  const { servicePrice, serviceFee, total } = useMemo(() => {
    const sp = isHourly
      ? Number.isFinite(priceInDollars) && Number.isFinite(hoursNum)
        ? Math.round(priceInDollars * hoursNum * 100) / 100
        : 0
      : Number.isFinite(priceInDollars)
        ? priceInDollars
        : 0;
    const fee = calculateServiceFee(sp);
    const t = Math.round((sp + fee) * 100) / 100;
    return { servicePrice: sp, serviceFee: fee, total: t };
  }, [isHourly, priceInDollars, hoursNum]);

  const formattedDate = proposedDate
    ? new Date(proposedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const formattedTime = proposedTime
    ? new Date(`2000-01-01T${proposedTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  async function handleContinueFromStep1() {
    const fields: (keyof ServiceBookingFormValues)[] = [
      "proposedDate",
      "proposedTime",
    ];
    if (isHourly) {
      fields.push("hours");
    }
    const ok = await trigger(fields);
    if (ok) {
      setStep(2);
    }
  }

  async function onSubmit(values: ServiceBookingFormValues) {
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        listingId: listing.id,
        paymentMethodId: values.paymentMethodId,
        proposedDate: values.proposedDate,
        proposedTime: values.proposedTime,
        notes: values.notes?.trim() || null,
        serviceAgreementAccepted: values.serviceAgreementAccepted,
        cancellationRefundAcknowledged:
          values.cancellationRefundAcknowledged ?? false,
        safetyLiabilityAccepted: values.safetyLiabilityAccepted ?? false,
        paymentPayoutAccepted: values.paymentPayoutAccepted ?? false,
        platformTermsAccepted: values.platformTermsAccepted ?? false,
      };
      if (isHourly) {
        body.hours = Number.parseFloat(String(values.hours));
      }
      const res = await fetch("/api/services/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not create booking request");
        return;
      }
      const bookingId = data.bookingId as string;
      toast.success("Booking request sent!");
      router.push(`${bookingSuccessHref}/${bookingId}?new=1`);
      // Destination booking detail page is RSC-rendered (no query cache entry);
      // router.refresh() busts the router cache so the new booking renders.
      // Intentional.
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <div className="space-y-6">
        <nav aria-label="Booking progress">
          <ol className="flex items-center justify-between">
            {steps.map((s, index) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isComplete = step > s.id;

              return (
                <li key={s.id} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : isComplete
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`hidden text-sm font-medium sm:inline ${
                        isActive
                          ? "text-foreground"
                          : isComplete
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="text-muted-foreground/50 mx-2 h-4 w-4 shrink-0 sm:mx-4" />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
              <CardDescription className="space-y-1">
                <span className="block">Pick your preferred date and time</span>
                <span className="block">
                  You won&apos;t be charged until the provider accepts.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="proposedDate"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel
                        htmlFor="date"
                        className="flex items-center gap-2"
                      >
                        <CalendarDays className="text-muted-foreground h-4 w-4" />
                        Preferred date
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="date"
                          type="date"
                          min={new Date().toISOString().split("T")[0]}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="proposedTime"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel
                        htmlFor="time"
                        className="flex items-center gap-2"
                      >
                        <Clock className="text-muted-foreground h-4 w-4" />
                        Preferred time
                      </FormLabel>
                      <FormControl>
                        <Input id="time" type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isHourly && (
                <FormField
                  control={control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel
                        htmlFor="hours"
                        className="flex items-center gap-2"
                      >
                        <Timer className="text-muted-foreground h-4 w-4" />
                        Estimated Hours
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="hours"
                          type="number"
                          min={0.5}
                          step={0.5}
                          className="max-w-32"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <p className="text-muted-foreground text-xs">
                        Rate: {formatUsd(priceInDollars)}/hr
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel
                      htmlFor="notes"
                      className="flex items-center gap-2"
                    >
                      <FileText className="text-muted-foreground h-4 w-4" />
                      Add a note
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <p className="text-muted-foreground text-xs">
                      Share any details to help the provider prepare
                    </p>
                    <FormControl>
                      <Textarea
                        id="notes"
                        rows={3}
                        placeholder="Any special requests or details the provider should know..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => void handleContinueFromStep1()}
                >
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Price Summary</CardTitle>
              <CardDescription>
                Review your booking details and pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-muted/30 rounded-lg border p-4">
                <h3 className="text-foreground mb-3 text-sm font-medium">
                  Your booking details
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Service</dt>
                    <dd className="text-foreground font-medium">
                      {listing.title}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd className="text-foreground">{formattedDate}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Time</dt>
                    <dd className="text-foreground">{formattedTime}</dd>
                  </div>
                  {isHourly && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="text-foreground">
                        {hoursNum} hour{hoursNum !== 1 ? "s" : ""}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="text-foreground mb-3 text-sm font-medium">
                  Price Breakdown
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Service cost{" "}
                      {isHourly &&
                        `(${formatUsd(priceInDollars)}/hr × ${hoursNum} hr${hoursNum !== 1 ? "s" : ""})`}
                    </dt>
                    <dd className="text-foreground">
                      {formatUsd(servicePrice)}
                    </dd>
                  </div>
                  <ServiceFeeLine amount={serviceFee} className="text-sm" />
                  <div className="flex justify-between border-t pt-2">
                    <dt className="text-foreground font-semibold">Total</dt>
                    <dd className="text-foreground font-semibold">
                      {formatUsd(total)}
                    </dd>
                  </div>
                </dl>
                <p className="text-muted-foreground mt-3 text-xs">
                  You&apos;ll be charged after the provider accepts your request
                </p>
              </div>

              {notes ? (
                <div className="bg-muted/30 rounded-lg border p-4">
                  <h3 className="text-foreground mb-2 text-sm font-medium">
                    Your Notes
                  </h3>
                  <p className="text-muted-foreground text-sm">{notes}</p>
                </div>
              ) : null}

              <div className="flex justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Your Request</CardTitle>
              <CardDescription>
                Review and submit your booking request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={control}
                name="paymentMethodId"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <div className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-foreground flex items-center gap-2 text-sm font-medium">
                          <CreditCard className="text-muted-foreground h-4 w-4" />
                          Payment Method
                        </h3>
                      </div>
                      {paymentMethods.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No payment methods found.{" "}
                          <Link
                            href={addPaymentMethodHref}
                            className="text-primary hover:underline"
                          >
                            Add a payment method
                          </Link>{" "}
                          to continue.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {paymentMethods.map((pm) => (
                            <label
                              key={pm.id}
                              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                                field.value === pm.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="paymentMethod"
                                  value={pm.id}
                                  checked={field.value === pm.id}
                                  onChange={() => field.onChange(pm.id)}
                                  className="text-primary h-4 w-4"
                                />
                                <div>
                                  <p className="text-foreground text-sm font-medium capitalize">
                                    {pm.brand} •••• {pm.last4}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    Expires {pm.expMonth}/{pm.expYear}
                                  </p>
                                </div>
                              </div>
                              {pm.isDefault ? (
                                <span className="text-muted-foreground text-xs">
                                  Default
                                </span>
                              ) : null}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-foreground text-sm font-medium">
                      Ready to submit your booking request
                    </p>
                    <p className="text-muted-foreground text-sm">
                      You&apos;re requesting <strong>{listing.title}</strong> on{" "}
                      <strong>{formattedDate}</strong> at{" "}
                      <strong>{formattedTime}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    Total charge
                  </span>
                  <span className="text-foreground text-lg font-semibold">
                    {formatUsd(total)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  You won&apos;t be charged until the provider accepts. Payment
                  is held securely until the service is completed.
                </p>
                <HowPaymentsWorkModal className="mt-1" />
              </div>

              <ServiceLegalDisclosures legalDocuments={legalDocuments} />

              <div className="flex justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => void handleSubmit(onSubmit)()}
                >
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending request...
                    </>
                  ) : (
                    "Request booking"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Form>
  );
}

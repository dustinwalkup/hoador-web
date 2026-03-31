"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Shield,
  CreditCard,
  XCircle,
  Scale,
} from "lucide-react";

import { HowPaymentsWorkModal } from "@/components/payments/how-payments-work-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ServiceBookingFormValues } from "@/features/services/lib/service-booking-form.schema";
import type { CurrentDocumentVersion } from "@/dal/types";

export interface ServiceLegalDocuments {
  serviceAgreement?: CurrentDocumentVersion;
  cancellationRefund?: CurrentDocumentVersion;
  safetyLiabilityPackage?: CurrentDocumentVersion;
  paymentPayout?: CurrentDocumentVersion;
  platformTerms?: CurrentDocumentVersion;
}

interface ServiceLegalDisclosuresProps {
  legalDocuments: ServiceLegalDocuments;
}

/**
 * Legal review and single-checkbox acceptance for service bookings (mirrors rental flow).
 *
 * @param legalDocuments - Current published versions for agreement and policies.
 */
export function ServiceLegalDisclosures({
  legalDocuments,
}: ServiceLegalDisclosuresProps) {
  const form = useFormContext<ServiceBookingFormValues>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const policies = [
    {
      id: "cancellation",
      icon: XCircle,
      title: "Cancellation & Refund Policy",
      document: legalDocuments.cancellationRefund,
      highlights: [
        "Refund rules depend on timing and who cancels the booking",
        "Pending bookings may be cancelled before payment is captured",
        "After acceptance, refunds may be partial or full per platform policy",
      ],
    },
    {
      id: "safety",
      icon: Shield,
      title: "Safety & Liability",
      document: legalDocuments.safetyLiabilityPackage,
      highlights: [
        "Parties assume appropriate risks related to the service setting",
        "Follow safe practices and any instructions from the provider",
        "Disputes and injuries may be subject to platform and legal policies",
      ],
    },
    {
      id: "payment",
      icon: CreditCard,
      title: "Payment & Payout Policy",
      document: legalDocuments.paymentPayout,
      highlights: [
        "Payment may be authorized or charged when the booking is accepted",
        "Platform fees and payouts follow published payment terms",
        "Refunds flow through the same payment method when applicable",
      ],
    },
    {
      id: "platform",
      icon: Scale,
      title: "Platform Terms",
      document: legalDocuments.platformTerms,
      highlights: [
        "Use of Hoador is governed by the Terms of Service",
        "Community guidelines and policies apply to all users",
        "The platform may update terms; continued use constitutes acceptance",
      ],
    },
  ];

  const handlePoliciesAccepted = (checked: boolean) => {
    form.setValue("serviceAgreementAccepted", checked);
    form.setValue("cancellationRefundAcknowledged", checked);
    form.setValue("safetyLiabilityAccepted", checked);
    form.setValue("paymentPayoutAccepted", checked);
    form.setValue("platformTermsAccepted", checked);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Review & Confirm</h3>
        <div className="flex items-center gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                View All Policies
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Service Policies & Agreement</DialogTitle>
                <DialogDescription>
                  Review all policies and agreements for this booking
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="cancellation" className="mt-4">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
                  <TabsTrigger value="cancellation">Cancellation</TabsTrigger>
                  <TabsTrigger value="safety">Safety</TabsTrigger>
                  <TabsTrigger value="payment">Payment</TabsTrigger>
                  <TabsTrigger value="platform">Platform</TabsTrigger>
                </TabsList>

                {policies.map((policy) => (
                  <TabsContent
                    key={policy.id}
                    value={policy.id}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <policy.icon className="text-muted-foreground mt-0.5 h-5 w-5" />
                        <div className="flex-1">
                          <h4 className="mb-2 font-semibold">{policy.title}</h4>
                          <ul className="space-y-2">
                            {policy.highlights.map((highlight, idx) => (
                              <li
                                key={idx}
                                className="text-muted-foreground flex items-start gap-2 text-sm"
                              >
                                <span className="text-primary mt-0.5">•</span>
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {policy.document?.url ? (
                        <Link
                          href={policy.document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          Read full policy
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {legalDocuments.serviceAgreement ? (
                <div className="mt-6 space-y-3 border-t pt-6">
                  <div className="flex items-start gap-3">
                    <FileText className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div className="flex-1">
                      <h4 className="mb-2 font-semibold">Service Agreement</h4>
                      <p className="text-muted-foreground mb-2 text-sm">
                        Specific terms for this booking including schedule,
                        pricing, and responsibilities of both parties.
                      </p>
                      {legalDocuments.serviceAgreement.url ? (
                        <Link
                          href={legalDocuments.serviceAgreement.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          Read full agreement
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1">
        {policies.map((policy) => (
          <Card
            key={policy.id}
            className="hover:border-primary/50 border-none shadow-none transition-colors"
          >
            <CardContent className="">
              <div className="flex items-start gap-3">
                <policy.icon className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="text-sm font-medium">{policy.title}</h4>
                  </div>
                  <ul className="space-y-1">
                    {policy.highlights.slice(0, 2).map((highlight, idx) => (
                      <li
                        key={idx}
                        className="text-muted-foreground flex items-start gap-1.5 text-xs"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        <span className="line-clamp-1">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  {policy.id === "payment" ? (
                    <HowPaymentsWorkModal className="mt-2" />
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <FormField
            control={form.control}
            name="serviceAgreementAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                <FormControl>
                  <Checkbox
                    id="serviceAgreementAccepted"
                    aria-label="I agree to the Service Agreement and all policies"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      handlePoliciesAccepted(checked === true);
                    }}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="flex-1 space-y-1 leading-none">
                  <FormLabel
                    htmlFor="serviceAgreementAccepted"
                    className="cursor-pointer text-sm font-medium"
                  >
                    I agree to the Service Agreement and all policies
                  </FormLabel>
                  <p className="text-muted-foreground text-xs">
                    By checking this box, you agree to the{" "}
                    {legalDocuments.serviceAgreement?.url ? (
                      <Link
                        href={legalDocuments.serviceAgreement.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        Service Agreement
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "Service Agreement"
                    )}
                    , Cancellation &amp; Refund Policy, Safety &amp; Liability,
                    Payment &amp; Payout Policy, and Platform Terms
                  </p>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

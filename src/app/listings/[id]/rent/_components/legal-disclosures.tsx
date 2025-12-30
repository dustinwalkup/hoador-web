"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Shield,
  AlertTriangle,
  CreditCard,
  XCircle,
} from "lucide-react";

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
import type { RentalFormData } from "@/features/rentals/lib/rental-form.schema";
import type { CurrentDocumentVersion } from "@/dal/legal-document.dal";

interface LegalDisclosuresProps {
  legalDocuments: {
    rentalAgreement?: CurrentDocumentVersion;
    cancellationRefund?: CurrentDocumentVersion;
    safetyDisclaimer?: CurrentDocumentVersion;
    damageLossLiability?: CurrentDocumentVersion;
    paymentPayout?: CurrentDocumentVersion;
  };
}

export function LegalDisclosures({ legalDocuments }: LegalDisclosuresProps) {
  const form = useFormContext<RentalFormData>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const policies = [
    {
      id: "cancellation",
      icon: XCircle,
      title: "Cancellation & Refund",
      document: legalDocuments.cancellationRefund,
      highlights: [
        "Full refund if cancelled 48+ hours before",
        "50% refund if cancelled 24-48 hours before",
        "No refund if cancelled within 24 hours",
      ],
    },
    {
      id: "safety",
      icon: AlertTriangle,
      title: "Safety Disclaimer",
      document: legalDocuments.safetyDisclaimer,
      highlights: [
        "You assume all risk when using tools",
        "Follow all manufacturer instructions",
        "Platform not liable for personal injury",
      ],
    },
    {
      id: "damage",
      icon: Shield,
      title: "Damage & Liability",
      document: legalDocuments.damageLossLiability,
      highlights: [
        "You're responsible for damage beyond normal wear",
        "Security deposit covers minor damages",
        "Lost or stolen tools charged at replacement cost",
      ],
    },
    {
      id: "payment",
      icon: CreditCard,
      title: "Payment & Payout",
      document: legalDocuments.paymentPayout,
      highlights: [
        "Card authorized at booking, charged after pickup",
        "Security deposit held until return",
        "Refunds processed within 5-7 business days",
      ],
    },
  ];

  // Handler to set all policy fields when checkbox is toggled
  const handlePoliciesAccepted = (checked: boolean) => {
    form.setValue("rentalAgreementAccepted", checked);
    form.setValue("safetyDisclaimerAccepted", checked);
    form.setValue("damageLossLiabilityAccepted", checked);
    form.setValue("paymentPayoutAccepted", checked);
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
                <DialogTitle>Rental Policies & Agreement</DialogTitle>
                <DialogDescription>
                  Review all policies and agreements for this rental
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="cancellation" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="cancellation">Cancellation</TabsTrigger>
                  <TabsTrigger value="safety">Safety</TabsTrigger>
                  <TabsTrigger value="damage">Damage</TabsTrigger>
                  <TabsTrigger value="payment">Payment</TabsTrigger>
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
                      {policy.document?.url && (
                        <Link
                          href={policy.document.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          Read full policy
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              {legalDocuments.rentalAgreement && (
                <div className="mt-6 space-y-3 border-t pt-6">
                  <div className="flex items-start gap-3">
                    <FileText className="text-muted-foreground mt-0.5 h-5 w-5" />
                    <div className="flex-1">
                      <h4 className="mb-2 font-semibold">Rental Agreement</h4>
                      <p className="text-muted-foreground mb-2 text-sm">
                        Specific terms for this rental including dates, pricing,
                        and both party responsibilities.
                      </p>
                      {legalDocuments.rentalAgreement.url && (
                        <Link
                          href={legalDocuments.rentalAgreement.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          Read full agreement
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {legalDocuments.rentalAgreement?.url && (
        <Link
          href={legalDocuments.rentalAgreement.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex w-full items-center justify-center gap-1 text-sm hover:underline"
        >
          <FileText className="h-4 w-4" />
          Rental Agreement
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}

      {/* Compact Policy Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {policies.map((policy) => (
          <Card
            key={policy.id}
            className="hover:border-primary/50 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <policy.icon className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Single Checkbox Acceptance */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <FormField
            control={form.control}
            name="rentalAgreementAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                <FormControl>
                  <Checkbox
                    id="rentalAgreementAccepted"
                    aria-label="I agree to the Rental Agreement and all policies"
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
                    htmlFor="rentalAgreementAccepted"
                    className="cursor-pointer text-sm font-medium"
                  >
                    I agree to the Rental Agreement and all policies
                  </FormLabel>
                  <p className="text-muted-foreground text-xs">
                    By checking this box, you agree to the Rental Agreement,
                    Cancellation & Refund Policy, Safety Disclaimer, Damage &
                    Liability Policy, and Payment & Payout Policy
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

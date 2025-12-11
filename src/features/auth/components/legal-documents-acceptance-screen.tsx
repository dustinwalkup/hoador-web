"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { acceptLegalDocumentsAction } from "../actions/accept-legal-documents";

interface LegalDocumentsAcceptanceScreenProps {
  firstName: string;
  documentUrls: {
    tos: string;
    privacy: string;
  };
}

type AcceptLegalDocumentsResult = {
  success: boolean;
  error?: string;
};

export function LegalDocumentsAcceptanceScreen({
  firstName,
  documentUrls,
}: LegalDocumentsAcceptanceScreenProps) {
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  const [state, formAction, isPending] = useActionState<
    AcceptLegalDocumentsResult | null,
    FormData
  >(acceptLegalDocumentsAction, null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!legalAccepted) {
      return;
    }

    startTransition(() => {
      const formData = new FormData();
      // Set both TOS and Privacy as accepted when legalAccepted is true
      formData.append("tosAccepted", String(legalAccepted));
      formData.append("privacyAccepted", String(legalAccepted));
      formAction(formData);
    });
  };

  const isFormPending = isPending || isTransitionPending;
  const canSubmit = legalAccepted;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome, {firstName}!</h1>
        <p className="text-muted-foreground text-sm">
          Before continuing, please acknowledge the following:
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="legalAccepted"
              checked={legalAccepted}
              onCheckedChange={(checked) => setLegalAccepted(checked === true)}
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="legalAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link
                  href={documentUrls.tos}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href={documentUrls.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isFormPending || !canSubmit}
        >
          {isFormPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
    </div>
  );
}

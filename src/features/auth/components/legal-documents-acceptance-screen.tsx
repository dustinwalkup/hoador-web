"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAcceptLegalDocuments } from "../hooks/use-auth-mutations";

interface LegalDocumentsAcceptanceScreenProps {
  firstName: string;
  documentUrls: {
    tos: string;
    privacy: string;
  };
}

export function LegalDocumentsAcceptanceScreen({
  firstName,
  documentUrls,
}: LegalDocumentsAcceptanceScreenProps) {
  const [legalAccepted, setLegalAccepted] = useState(false);
  const mutation = useAcceptLegalDocuments();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!legalAccepted) {
      return;
    }

    try {
      await mutation.mutateAsync({
        tosAccepted: legalAccepted,
        privacyAccepted: legalAccepted,
      });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome, {firstName}!</h1>
        <p className="text-muted-foreground text-sm">
          Before continuing, please acknowledge the following:
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to accept legal documents"}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="legalAccepted"
              checked={legalAccepted}
              onCheckedChange={(checked) => setLegalAccepted(checked === true)}
              disabled={mutation.isPending}
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
          disabled={mutation.isPending || !legalAccepted}
        >
          {mutation.isPending ? (
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

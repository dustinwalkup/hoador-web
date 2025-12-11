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
    community: string;
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
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [communityAccepted, setCommunityAccepted] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  const [state, formAction, isPending] = useActionState<
    AcceptLegalDocumentsResult | null,
    FormData
  >(acceptLegalDocumentsAction, null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!tosAccepted || !privacyAccepted || !communityAccepted) {
      return;
    }

    startTransition(() => {
      const formData = new FormData();
      formData.append("tosAccepted", String(tosAccepted));
      formData.append("privacyAccepted", String(privacyAccepted));
      formData.append("communityAccepted", String(communityAccepted));
      formAction(formData);
    });
  };

  const isFormPending = isPending || isTransitionPending;
  const canSubmit = tosAccepted && privacyAccepted && communityAccepted;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome, {firstName}</h1>
        <p className="text-muted-foreground">
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
              id="tosAccepted"
              checked={tosAccepted}
              onCheckedChange={(checked) => setTosAccepted(checked === true)}
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="tosAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{" "}
                <Link
                  href={documentUrls.tos}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Terms of Service
                </Link>
              </Label>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="privacyAccepted"
              checked={privacyAccepted}
              onCheckedChange={(checked) =>
                setPrivacyAccepted(checked === true)
              }
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="privacyAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{" "}
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

          <div className="flex items-start space-x-2">
            <Checkbox
              id="communityAccepted"
              checked={communityAccepted}
              onCheckedChange={(checked) =>
                setCommunityAccepted(checked === true)
              }
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="communityAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{" "}
                <Link
                  href={documentUrls.community}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Community Guidelines
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

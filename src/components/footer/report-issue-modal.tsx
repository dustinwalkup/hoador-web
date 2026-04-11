"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@hoador.com";

interface ReportIssueModalProps {
  children?: React.ReactNode;
}

export function ReportIssueModal({ children }: ReportIssueModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEmail = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <button className="text-muted-foreground hover:text-foreground text-left text-sm transition-colors">
            Report an Issue
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Send us an email and we&apos;ll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <div className="relative space-y-4">
          {copied && (
            <p className="text-primary absolute -top-6 right-0 text-center text-xs">
              Copied to clipboard
            </p>
          )}
          <div className="bg-muted/50 flex items-center justify-between rounded-md border px-4 py-3">
            <span className="text-sm font-medium">{SUPPORT_EMAIL}</span>
            <button
              onClick={handleCopyEmail}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy email address"
            >
              {copied ? (
                <Check className="text-primary h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="bg-border h-px flex-1" />
          </div>
          <Button
            onClick={handleOpenEmail}
            variant="outline"
            className="w-full"
          >
            <Mail className="mr-2 h-4 w-4" />
            Open in Email App
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

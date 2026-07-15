"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { NeighborhoodNeed } from "@/db/schemas/neighborhood-needs.schema";

interface NeedShareSuccessProps {
  need: NeighborhoodNeed;
}

export function NeedShareSuccess({ need }: NeedShareSuccessProps) {
  const [copied, setCopied] = useState(false);

  const needUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/needs/${need.id}`
      : `/dashboard/needs/${need.id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(needUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select/copy via execCommand
      const ta = document.createElement("textarea");
      ta.value = needUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: need.title,
        text: need.description,
        url: needUrl,
      });
    } catch {
      // user dismissed or share failed — no-op
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Need posted!</h2>
            <p className="text-muted-foreground text-sm">
              Your neighbors will be able to see it and create listings in
              response.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button className="w-full" onClick={handleCopy} variant="outline">
              {copied ? (
                <>
                  <CheckCircle2 className="text-primary mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </>
              )}
            </Button>

            {canNativeShare && (
              <Button
                className="w-full"
                onClick={handleShare}
                variant="outline"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}

            <Button asChild className="w-full">
              <Link href={`/dashboard/needs/${need.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View my need
              </Link>
            </Button>
          </div>

          <Link
            href="/dashboard/needs"
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Back to feed
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

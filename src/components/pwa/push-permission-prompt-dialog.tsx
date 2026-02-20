"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markPromptShown } from "@/lib/pwa/use-push-permission";
import { enablePush } from "@/lib/pwa/enable-push";
import { Bell } from "lucide-react";

export interface PushPermissionPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user enables push (after successful subscription) or dismisses. */
  onComplete: (enabled: boolean) => void;
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = "Get notified";
const DEFAULT_DESCRIPTION =
  "Enable push notifications to hear when the owner responds to your request and for other updates.";

/**
 * In-app prompt to enable push notifications. On "Enable", requests permission,
 * subscribes, and POSTs to /api/push/subscribe; then marks prompt as shown and calls onComplete(true).
 * On "Not now", marks prompt as shown and calls onComplete(false).
 */
export function PushPermissionPromptDialog({
  open,
  onOpenChange,
  onComplete,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: PushPermissionPromptDialogProps) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setError(null);
    setIsEnabling(true);
    try {
      const result = await enablePush();
      markPromptShown();
      if (result.success) {
        onOpenChange(false);
        onComplete(true);
      } else {
        if (result.reason === "denied") {
          markPromptShown();
          onOpenChange(false);
          onComplete(false);
        } else {
          setError(result.message ?? "Something went wrong");
        }
      }
    } finally {
      setIsEnabling(false);
    }
  };

  const handleNotNow = () => {
    markPromptShown();
    onOpenChange(false);
    onComplete(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
              <Bell className="text-primary h-5 w-5" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleNotNow}
            disabled={isEnabling}
          >
            Not now
          </Button>
          <Button type="button" onClick={handleEnable} disabled={isEnabling}>
            {isEnabling ? "Enabling…" : "Enable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

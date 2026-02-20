"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { shouldShowPermissionPrompt } from "@/lib/pwa/use-push-permission";
import { PushPermissionPromptDialog } from "@/components/pwa/push-permission-prompt-dialog";
import { toast } from "sonner";

interface PushPermissionPromptFromUrlProps {
  rentalId: string;
}

/**
 * When rendered with firstApproval (and isRenter), shows the push permission
 * prompt dialog if the user has not yet been prompted and permission is default.
 * Requirements: 5.2
 */
export function PushPermissionPromptFromUrl({
  rentalId,
}: PushPermissionPromptFromUrlProps) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (shouldShowPermissionPrompt()) {
      queueMicrotask(() => setShow(true));
    }
  }, [mounted]);

  const handleComplete = (enabled: boolean) => {
    if (enabled) {
      toast.success("Push notifications enabled");
    }
    // Remove firstApproval from URL so we don't show the prompt again on refresh
    router.replace(`/dashboard/rental/${rentalId}?view=renting`, {
      scroll: false,
    });
  };

  return (
    <PushPermissionPromptDialog
      open={show}
      onOpenChange={setShow}
      onComplete={handleComplete}
      title="Get notified about your rentals"
      description="Enable push notifications so you never miss an update when your rental is approved or when pickup and return reminders are due."
    />
  );
}

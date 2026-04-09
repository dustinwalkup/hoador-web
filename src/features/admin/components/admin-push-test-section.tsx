"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TestPushResponse = {
  sent?: boolean;
  message?: string;
  error?: string;
  subscriptionCount?: number;
  vapidConfigured?: boolean;
};

/**
 * Admin-only: POST /api/push/test for the signed-in user (staging / device debugging).
 */
export function AdminPushTestSection() {
  const [pending, setPending] = useState(false);

  const handleTestPush = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as TestPushResponse;

      if (!res.ok) {
        toast.error("Test push failed", {
          description: data.error ?? res.statusText,
        });
        return;
      }

      if (data.sent) {
        toast.success(data.message ?? "Test push sent", {
          description: [
            `Subscriptions: ${data.subscriptionCount ?? "—"}`,
            `VAPID configured (server): ${data.vapidConfigured === true ? "yes" : data.vapidConfigured === false ? "no" : "—"}`,
          ].join(" · "),
        });
      } else {
        toast.message("No push sent", {
          description: [
            data.error ?? "Unknown reason",
            `subscriptionCount: ${data.subscriptionCount ?? 0}`,
            `vapidConfigured: ${String(data.vapidConfigured)}`,
          ].join(" · "),
        });
      }
    } catch (e) {
      toast.error("Request failed", {
        description: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="mb-6 md:hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" aria-hidden />
          Push (staging / debug)
        </CardTitle>
        <CardDescription>
          Sends a test Web Push to this browser for your signed-in admin
          account. Requires an active subscription from{" "}
          <span className="font-medium">Enable push on this device</span> in
          profile notification settings (or a completed mobile rental prompt).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          onClick={handleTestPush}
          disabled={pending}
          variant="secondary"
        >
          {pending ? "Sending…" : "Send test push to this device"}
        </Button>
      </CardContent>
    </Card>
  );
}

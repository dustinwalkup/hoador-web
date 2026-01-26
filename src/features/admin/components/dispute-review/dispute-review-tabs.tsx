"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePendingDisputesCount } from "@/features/admin/hooks/use-pending-disputes-count";
import { PendingDisputeQueue } from "./pending-dispute-queue";
import { DisputeReviewHistory } from "./dispute-review-history";

export function DisputeReviewTabs() {
  const [activeTab, setActiveTab] = useState("pending");
  const { data: pendingCount = 0 } = usePendingDisputesCount();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="max-w-96">
        <TabsTrigger value="pending" className="flex items-center gap-2">
          Pending Review
          {pendingCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
              {pendingCount > 99 ? "99+" : pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history">Review History</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-6">
        <PendingDisputeQueue />
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <DisputeReviewHistory />
      </TabsContent>
    </Tabs>
  );
}

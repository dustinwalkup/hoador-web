"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAdminBadges } from "@/features/admin/hooks/use-admin-badges";
import { PendingReviewQueue } from "./pending-review-queue";
import { ReviewHistory } from "./review-history";

export function ListingReviewTabs() {
  const [activeTab, setActiveTab] = useState("pending");
  const { data: badges } = useAdminBadges();
  const pendingCount = badges?.pendingListingReviews ?? 0;

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
        <PendingReviewQueue />
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <ReviewHistory />
      </TabsContent>
    </Tabs>
  );
}

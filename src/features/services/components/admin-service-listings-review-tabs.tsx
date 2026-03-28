"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { ServiceListingReviewWithCategoryAndProvider } from "@/dal/service-listing.dal";
import { AdminServiceListingsReview } from "./admin-service-listings-review";
import { AdminServiceListingsReviewHistory } from "@/features/services/components/admin-service-listings-review-history";

interface AdminServiceListingsReviewTabsProps {
  listings: ServiceListingReviewWithCategoryAndProvider[];
}

export function AdminServiceListingsReviewTabs({
  listings,
}: AdminServiceListingsReviewTabsProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const pendingCount = listings.length;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "pending" | "history")}
      className="w-full"
    >
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
        <AdminServiceListingsReview listings={listings} />
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <AdminServiceListingsReviewHistory />
      </TabsContent>
    </Tabs>
  );
}

"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import type { ServiceListingCategoryInfo } from "@/dal/service-listing.dal";

import { MyServiceListingsTabsClient } from "./my-service-listings-tabs-client";

interface MyServiceListingsClientProps {
  categories: ServiceListingCategoryInfo[];
}

export function MyServiceListingsClient({
  categories,
}: MyServiceListingsClientProps) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "active";

  return (
    <div className="container pb-6">
      <PageHeader
        title="My Services"
        description="Manage your service listings in one place"
      >
        <Link href="/dashboard/services/listings/create">
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add New Listing
          </Button>
        </Link>
      </PageHeader>

      <MyServiceListingsTabsClient
        currentTab={currentTab}
        categories={categories}
      />
    </div>
  );
}

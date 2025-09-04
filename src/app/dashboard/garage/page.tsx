import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";

import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

import { ActiveTab } from "./_components/active-tab";
import { InactiveTab } from "./_components/inactive-tab";
import { ArchivedTab } from "./_components/archived-tab";
import { GarageFilters } from "./_components/garage-filters";
import { GarageTabs } from "./_components/garage-tabs";
import type { GarageListingFilters } from "@/dal/listing.dal";
import { listingDAL } from "@/dal";

interface GaragePageProps {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: string;
    rentalStatus?: string;
  }>;
}

async function GarageFiltersWithCategories({
  currentTab,
  filters,
}: {
  currentTab: string;
  filters: GarageListingFilters;
}) {
  const categories = await listingDAL.getListingCategories();

  return (
    <GarageFilters
      currentTab={currentTab}
      filters={filters}
      categories={categories}
    />
  );
}

export default async function GaragePage({ searchParams }: GaragePageProps) {
  const params = await searchParams;

  // Parse search parameters into filters
  const filters: GarageListingFilters = {
    query: params.q,
    categoryId: params.category,
    sortBy: params.sortBy as "newest" | "name" | "lastRented" | undefined,
    sortOrder: params.sortOrder as "asc" | "desc" | undefined,
    rentalStatus: params.rentalStatus as "available" | "rented" | undefined,
  };

  const currentTab = params.tab || "active";

  return (
    <div className="container py-6">
      <PageHeader
        title="Garage"
        description="Manage your listings and rentals in one place"
      >
        <Link href="/dashboard/listings/add">
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add New Listing
          </Button>
        </Link>
      </PageHeader>

      <GarageTabs currentTab={currentTab}>
        <Suspense
          fallback={
            <div className="flex justify-between">
              <div className="bg-muted mt-6 h-10 w-1/3 animate-pulse rounded" />
              <div className="bg-muted mt-6 h-10 w-1/3 animate-pulse rounded" />
            </div>
          }
        >
          <GarageFiltersWithCategories
            currentTab={currentTab}
            filters={filters}
          />
        </Suspense>

        <Suspense
          fallback={
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-muted h-96 animate-pulse rounded" />
              ))}
            </div>
          }
        >
          <TabsContent value="active" className="mt-6">
            <ActiveTab filters={filters} />
          </TabsContent>

          <TabsContent value="inactive" className="mt-6">
            <InactiveTab filters={filters} />
          </TabsContent>

          <TabsContent value="archived" className="mt-6">
            <ArchivedTab filters={filters} />
          </TabsContent>
        </Suspense>
      </GarageTabs>
    </div>
  );
}

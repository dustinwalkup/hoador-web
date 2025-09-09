"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

import { GarageTabsClient } from "./garage-tabs-client";

export function GarageClient() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "active";

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

      <GarageTabsClient currentTab={currentTab} />
    </div>
  );
}

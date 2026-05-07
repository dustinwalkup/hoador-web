"use client";

import { useState } from "react";

import type { ServiceListing } from "@/db/schemas/services.schema";

import { ServiceListingCard } from "./service-listing-card";
import { ServiceListingManagementModal } from "./service-listing-management-modal";

interface ServiceListingCardWithManageProps {
  listing: ServiceListing;
}

/**
 * Service listing card with Manage wired to {@link ServiceListingManagementModal}.
 */
export function ServiceListingCardWithManage({
  listing,
}: ServiceListingCardWithManageProps) {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <>
      <ServiceListingCard
        listing={listing}
        onManage={() => setManageOpen(true)}
      />
      <ServiceListingManagementModal
        listing={listing}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}

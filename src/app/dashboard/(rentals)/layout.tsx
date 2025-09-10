"use client";
import { usePathname } from "next/navigation";
import { hideRentalHeader } from "@/features/rentals/lib/utils";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { RentalsTabs } from "@/features/rentals/components/renting-lending/rentals-tabs";

export default function RentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideHeading = hideRentalHeader(pathname);

  return (
    <div className={cn("container mx-auto", hideHeading ? "py-0" : "py-6")}>
      {!hideHeading && (
        <PageHeader
          title="Rentals"
          description="Manage your rentals"
          className="mb-8"
        />
      )}
      <RentalsTabs>{children}</RentalsTabs>
    </div>
  );
}

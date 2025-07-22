"use client";
import { usePathname } from "next/navigation";
import { hideRentalHeader } from "@/lib/utils/rentals.utils";
import { cn } from "@/lib/utils/utils";
import { PageHeader } from "@/components/page-header";
import { RentalsTabs } from "./_components/rentals-tabs";

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

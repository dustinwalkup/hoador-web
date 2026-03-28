"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

function getHeaderConfig(pathname: string): {
  title: string;
  description: string;
} {
  const parts = pathname.split("/").filter(Boolean);
  const rentalsIndex = parts.indexOf("rentals");
  const direction = rentalsIndex !== -1 ? parts[rentalsIndex + 1] : undefined;

  if (direction === "incoming") {
    return {
      title: "Rentals - Owner",
      description: "Manage your incoming rental requests",
    };
  }
  return {
    title: "Rentals - Renter",
    description: "Manage your rental booking requests",
  };
}

/**
 * Layout for /dashboard/rentals/* list flow: shared PageHeader by lending vs renting direction.
 */
export default function RentalsFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, description } = getHeaderConfig(pathname);

  return (
    <div className={cn("container mx-auto pb-6")}>
      <PageHeader title={title} description={description} className="mb-6" />
      {children}
    </div>
  );
}

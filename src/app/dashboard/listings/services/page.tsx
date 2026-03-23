import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "My Services",
  description: "Manage your service listings",
};

export default function ListingsServicesPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title="My Services"
        description="Browse the marketplace or manage listings you offer."
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/services">Browse services</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/services/listings/create">Create listing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/services/bookings">My service bookings</Link>
        </Button>
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/page-header";
import { RentalsTabs } from "./_components/rentals-tabs";

export default function RentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Rentals"
        description="Manage your rentals"
        className="mb-8"
      />
      <RentalsTabs>{children}</RentalsTabs>
    </div>
  );
}

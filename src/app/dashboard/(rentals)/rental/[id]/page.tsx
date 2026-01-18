export const dynamic = "force-dynamic";
import { RentalDetailsServer } from "@/features/rentals/components/detail-page";

export const metadata = {
  title: "Rental Details",
  description: "View detailed information about this rental",
};

interface RentalDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: RentalDetailPageProps) {
  const { id } = await params;
  const { view } = await searchParams;

  return <RentalDetailsServer rentalId={id} view={view} />;
}

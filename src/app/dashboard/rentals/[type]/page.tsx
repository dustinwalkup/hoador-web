import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

interface RentalsTypePageProps {
  params: Promise<{
    type: string;
  }>;
}

export default async function RentalsTypePage({
  params,
}: RentalsTypePageProps) {
  const { type } = await params;

  // Validate type and redirect to default status
  if (type === "renting") {
    redirect("/dashboard/rentals/renting/requests");
  } else if (type === "lending") {
    redirect("/dashboard/rentals/lending/incoming");
  } else {
    notFound();
  }
}

export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";

export const metadata = {
  title: "Rentals",
  description: "Manage your rentals and lending activities",
};

interface RentalsDirectionPageProps {
  params: Promise<{
    direction: "incoming" | "outgoing";
  }>;
}

export default async function RentalsDirectionPage({
  params,
}: RentalsDirectionPageProps) {
  const { direction } = await params;

  // Validate direction and redirect to default status
  if (direction === "incoming") {
    redirect("/dashboard/rentals/incoming/requests");
  } else if (direction === "outgoing") {
    redirect("/dashboard/rentals/outgoing/requests");
  } else {
    notFound();
  }
}

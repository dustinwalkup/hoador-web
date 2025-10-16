export const dynamic = "force-dynamic";
import { redirect, notFound } from "next/navigation";

export const metadata = {
  title: "Rentals | Hoador",
  description: "Manage your rentals and lending activities",
};

interface RentalsTypePageProps {
  params: Promise<{
    type: "renting" | "lending";
  }>;
}

export default async function RentalsTypePage({
  params,
}: RentalsTypePageProps) {
  const { type } = await params;

  // Validate type and redirect to default status
  if (type === "renting") {
    redirect("/dashboard/renting/requests");
  } else if (type === "lending") {
    redirect("/dashboard/lending/incoming");
  } else {
    notFound();
  }
}

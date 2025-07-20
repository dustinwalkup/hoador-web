import { redirect } from "next/navigation";

export default function RentalsPage() {
  // Redirect to the default rentals view (renting requests)
  redirect("/dashboard/renting/requests");
}

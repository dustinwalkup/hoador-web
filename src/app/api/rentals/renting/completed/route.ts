import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET() {
  const { data, error } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalsByStatus("completed");
    })(),
  );

  if (error) {
    console.error("Error fetching completed renting:", error);
    return Response.json(
      { error: error.message || "Failed to fetch completed rentals" },
      { status: 500 },
    );
  }

  return Response.json({ data, status: "success" });
}

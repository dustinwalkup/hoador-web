import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET() {
  const { data, error } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalsByStatus("active");
    })(),
  );

  if (error) {
    console.error("Error fetching active renting:", error);
    return Response.json(
      { error: error.message || "Failed to fetch active rentals" },
      { status: 500 },
    );
  }

  return Response.json({ data, status: "success" });
}

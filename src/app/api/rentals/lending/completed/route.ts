import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(request: NextRequest) {
  const { data, error } = await tryCatch(
    (async () => {
      return await rentalDAL.getLendingRentalsByStatus("completed");
    })(),
  );

  if (error) {
    console.error("Error fetching completed lending:", error);
    return Response.json(
      { error: error.message || "Failed to fetch completed lending" },
      { status: 500 },
    );
  }

  return Response.json({ data, status: "success" });
}

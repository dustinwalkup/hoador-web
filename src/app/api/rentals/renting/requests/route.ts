import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status =
    (searchParams.get("status") as "pending" | "approved" | "denied") ||
    "pending";

  const { data, error } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalRequestsByStatus(status);
    })(),
  );

  if (error) {
    console.error("Error fetching renting requests:", error);
    return Response.json(
      { error: error.message || "Failed to fetch renting requests" },
      { status: 500 },
    );
  }

  return Response.json({ data, status: "success" });
}

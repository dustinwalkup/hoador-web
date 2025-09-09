import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status =
    (searchParams.get("status") as
      | "pending"
      | "rejected"
      | "active"
      | "completed") || "pending";

  const { data, error } = await tryCatch(
    (async () => {
      if (status === "active" || status === "completed") {
        return await rentalDAL.getLendingRentalsByStatus(status);
      }
      return await rentalDAL.getLendingRequestsByStatus(status);
    })(),
  );

  if (error) {
    console.error("Error fetching lending requests:", error);
    return Response.json(
      { error: error.message || "Failed to fetch lending requests" },
      { status: 500 },
    );
  }

  return Response.json({ data, status: "success" });
}

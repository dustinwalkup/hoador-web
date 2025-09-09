import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data, error } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalDetailsById(id);
    })(),
  );

  if (error) {
    console.error("Error fetching rental details:", error);
    return Response.json(
      { error: error.message || "Failed to fetch rental details" },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({ error: "Rental not found" }, { status: 404 });
  }

  return Response.json(data);
}

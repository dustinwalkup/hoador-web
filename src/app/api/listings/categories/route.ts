import { listingDAL } from "@/dal";

export async function GET() {
  try {
    const categories = await listingDAL.getListingCategories();
    return Response.json(categories);
  } catch (error) {
    console.error("Listing categories error:", error);
    return Response.json(
      { error: "Failed to fetch listing categories" },
      { status: 500 },
    );
  }
}

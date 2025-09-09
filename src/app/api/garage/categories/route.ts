import { listingDAL } from "@/dal";

export async function GET() {
  try {
    const categories = await listingDAL.getListingCategories();

    return Response.json(categories);
  } catch (error) {
    console.error("Categories API error:", error);
    return Response.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

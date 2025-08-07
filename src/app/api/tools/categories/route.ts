import { toolDAL } from "@/lib/dal";

export async function GET() {
  try {
    const categories = await toolDAL.getToolCategories();
    return Response.json(categories);
  } catch (error) {
    console.error("Tool categories error:", error);
    return Response.json(
      { error: "Failed to fetch tool categories" },
      { status: 500 },
    );
  }
}

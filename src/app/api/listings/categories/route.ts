import { listingDAL } from "@/dal";
import { emojiMap } from "@/constants/garage";

import { withRequestLogging } from "@/lib/api/with-request-logging";

/**
 * GET /api/listings/categories
 *
 * Active top-level rental categories.
 *
 * The stored `icon` is an internal NAME ("drill", "wrench"), not something a
 * client can render. Web resolves it through `emojiMap` at each call site; the
 * mobile app can't reasonably carry a second copy of that map inside a released
 * binary, so the resolved glyph is returned as `emoji` here — one source of
 * truth, resolved once, for every client. `icon` is still returned unchanged so
 * existing web consumers keep working.
 */
async function getHandler() {
  try {
    const categories = await listingDAL.getListingCategories();

    return Response.json(
      categories.map((category) => ({
        ...category,
        emoji: category.icon ? (emojiMap[category.icon] ?? null) : null,
      })),
    );
  } catch (error) {
    console.error("Listing categories error:", error);
    return Response.json(
      { error: "Failed to fetch listing categories" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/listings/categories",
);

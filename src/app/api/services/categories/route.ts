import { NextResponse } from "next/server";
import { serviceListingDAL } from "@/dal";
import { SERVICE_CATEGORY_ICONS } from "@/constants/services";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";
import { withRequestLogging } from "@/lib/api/with-request-logging";

/**
 * GET /api/services/categories
 *
 * Service categories for the browse filter (mobile prerequisite P-E6-3).
 *
 * The web services page reads `listCategories()` straight from a server
 * component, so this list had no HTTP surface — and browse rows carry only a
 * `categoryId` with no name, leaving a second client unable to build a category
 * filter at all.
 *
 * Auth-required, matching the rest of `/api/services/*` (its sibling
 * `/api/listings/categories` is public; these are reference data either way, so
 * the stricter of the two conventions wins).
 *
 * There is no `icon` column here — the table is `{id, name, description}` — so
 * the glyph comes from `SERVICE_CATEGORY_ICONS`, web's name-keyed map (used by
 * the web browse filters and the need form). Resolving it here keeps that map
 * the single source of truth instead of copying it into a released binary, and
 * mirrors what `/api/listings/categories` does for the rental side.
 */
async function getHandler() {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const categories = await serviceListingDAL.listCategories();

    return NextResponse.json(
      categories.map((category) => ({
        ...category,
        // `?? "💼"` mirrors both web call sites: an unmapped category gets the
        // generic briefcase rather than rendering bare.
        emoji: SERVICE_CATEGORY_ICONS[category.name] ?? "💼",
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/categories",
);

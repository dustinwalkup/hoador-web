import type { PaginatedResult } from "@/dal/types";

/**
 * Build an empty {@link PaginatedResult} page without a DB round-trip.
 *
 * Used by visibility-aware search endpoints to fail closed: when the viewer
 * has no visible communities there is nothing to return, so we skip the query
 * entirely and hand back a well-formed empty page.
 */
export function emptyPaginatedResult<T>(
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: page > 1,
    },
  };
}

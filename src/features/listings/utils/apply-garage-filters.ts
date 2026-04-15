import type { UserListing } from "@/dal/listing.dal";
import type { GarageListingFilters } from "@/features/listings/hooks/garage-keys";

export function applyGarageFilters(
  listings: UserListing[],
  filters: GarageListingFilters,
): UserListing[] {
  let result = [...listings];

  if (filters.query) {
    const q = filters.query.toLowerCase();
    result = result.filter((l) => l.name.toLowerCase().includes(q));
  }

  if (filters.categoryId) {
    result = result.filter((l) => l.categoryId === filters.categoryId);
  }

  if (filters.rentalStatus) {
    result = result.filter((l) => l.status === filters.rentalStatus);
  }

  const sortBy = filters.sortBy ?? "newest";
  const sortOrder = filters.sortOrder ?? "desc";
  const dir = sortOrder === "asc" ? 1 : -1;

  if (sortBy === "name") {
    result.sort((a, b) => a.name.localeCompare(b.name) * dir);
  } else if (sortBy === "lastRented") {
    result.sort((a, b) => {
      const av = new Date(a.updatedAt).getTime();
      const bv = new Date(b.updatedAt).getTime();
      return (av - bv) * dir;
    });
  } else {
    result.sort((a, b) => {
      const av = new Date(a.createdAt).getTime();
      const bv = new Date(b.createdAt).getTime();
      return (av - bv) * dir;
    });
  }

  return result;
}

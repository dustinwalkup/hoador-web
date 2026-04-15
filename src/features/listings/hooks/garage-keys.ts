export interface GarageListingFilters {
  query?: string;
  categoryId?: string;
  sortBy?: "newest" | "name" | "lastRented";
  sortOrder?: "asc" | "desc";
  rentalStatus?: "available" | "rented";
}

export const garageKeys = {
  all: ["garage"] as const,
  active: () => [...garageKeys.all, "active"] as const,
  inactive: () => [...garageKeys.all, "inactive"] as const,
  archived: () => [...garageKeys.all, "archived"] as const,
  pendingReview: () => [...garageKeys.all, "pendingReview"] as const,
  pendingCount: () => [...garageKeys.all, "pendingCount"] as const,
  categories: () => [...garageKeys.all, "categories"] as const,
};

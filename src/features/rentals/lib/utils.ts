/**
 * Helper function to check if the rental header should be hidden
 * @param pathname - The pathname to check
 * @returns True if the rental header should be hidden, false otherwise
 */
export function hideRentalHeader(pathname: string): boolean {
  if (pathname.includes("rental") || pathname.includes("confirmation")) {
    return true;
  }
  return false;
}

interface RentalHeaderConfig {
  title: string;
  description: string;
}

/**
 * Get the appropriate header title and description based on the rental route
 * @param pathname - The current pathname (e.g., /dashboard/renting/requests)
 * @returns Object with title and description for the page header
 */
export function getRentalHeaderConfig(pathname: string): RentalHeaderConfig {
  // Extract type and status from pathname
  // Examples: /dashboard/renting/requests, /dashboard/lending/incoming
  const pathParts = pathname.split("/").filter(Boolean);
  const typeIndex =
    pathParts.indexOf("renting") !== -1
      ? pathParts.indexOf("renting")
      : pathParts.indexOf("lending");

  if (typeIndex === -1) {
    // Fallback to default
    return {
      title: "Rentals",
      description: "Manage your rentals",
    };
  }

  const type = pathParts[typeIndex]; // "renting" or "lending"
  const status = pathParts[typeIndex + 1]; // "requests", "incoming", "approved", etc.

  // Map to appropriate header content
  const configs: Record<string, Record<string, RentalHeaderConfig>> = {
    renting: {
      requests: {
        title: "Renting",
        description: "Items you've requested to rent",
      },
      approved: {
        title: "Renting",
        description: "Items you're approved to rent",
      },
      active: {
        title: "Renting",
        description: "Items you're currently renting",
      },
      completed: {
        title: "Renting",
        description: "Items you've finished renting",
      },
      denied: {
        title: "Renting",
        description: "Your denied rental requests",
      },
    },
    lending: {
      incoming: {
        title: "Lending",
        description: "Requests to rent your items",
      },
      approved: {
        title: "Lending",
        description: "Your items approved for rental",
      },
      active: {
        title: "Lending",
        description: "Your items currently being rented",
      },
      completed: {
        title: "Lending",
        description: "Your items that were rented",
      },
      denied: {
        title: "Lending",
        description: "Rental requests you've denied",
      },
    },
  };

  return (
    configs[type]?.[status] || {
      title: type === "renting" ? "Renting" : "Lending",
      description: "Manage your rentals",
    }
  );
}

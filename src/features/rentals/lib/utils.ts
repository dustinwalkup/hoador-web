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
 * @param pathname - The current pathname (e.g., /dashboard/rentals/incoming/requests)
 * @returns Object with title and description for the page header
 */
export function getRentalHeaderConfig(pathname: string): RentalHeaderConfig {
  // Extract direction and status from pathname
  // Examples: /dashboard/rentals/incoming/requests, /dashboard/rentals/outgoing/requests
  const pathParts = pathname.split("/").filter(Boolean);
  const rentalsIndex = pathParts.indexOf("rentals");

  if (rentalsIndex === -1 || pathParts.length < rentalsIndex + 3) {
    return {
      title: "Rentals",
      description: "Manage your rentals",
    };
  }

  const direction = pathParts[rentalsIndex + 1]; // "incoming" or "outgoing"
  const urlStatus = pathParts[rentalsIndex + 2]; // "requests", "approved", etc.
  // Map URL status to internal: incoming + "requests" -> "incoming"
  const status =
    direction === "incoming" && urlStatus === "requests"
      ? "incoming"
      : urlStatus;

  // Map to appropriate header content (incoming=owner/lending, outgoing=renter/renting)
  const typeKey = direction === "incoming" ? "lending" : "renting";
  const configs: Record<string, Record<string, RentalHeaderConfig>> = {
    renting: {
      requests: {
        title: "Renter",
        description: "Items you've requested to rent",
      },
      approved: {
        title: "Renter",
        description: "Items you're approved to rent",
      },
      active: {
        title: "Renter",
        description: "Items you're currently renting",
      },
      completed: {
        title: "Renter",
        description: "Items you've finished renting",
      },
      denied: {
        title: "Renter",
        description: "Your denied rental requests",
      },
    },
    lending: {
      incoming: {
        title: "Owner",
        description: "Requests to rent your items",
      },
      approved: {
        title: "Owner",
        description: "Your items approved for rental",
      },
      active: {
        title: "Owner",
        description: "Your items currently being rented",
      },
      completed: {
        title: "Owner",
        description: "Your items that were rented",
      },
      denied: {
        title: "Owner",
        description: "Rental requests you've denied",
      },
    },
  };

  return (
    configs[typeKey]?.[status] || {
      title: direction === "outgoing" ? "Renter" : "Owner",
      description: "Manage your rentals",
    }
  );
}

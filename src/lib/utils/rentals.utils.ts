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

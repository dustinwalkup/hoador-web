/**
 * Geo helpers for computing and displaying distances between two points.
 *
 * The rental search path computes distance server-side via PostGIS
 * (`ST_Distance`). For single-record / small-page cases (like the neighborhood
 * needs feed) a JS haversine keeps the query simple and avoids injecting viewer
 * coordinates into raw SQL. The ~0.3% difference vs. PostGIS's spheroid model is
 * irrelevant at display precision.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3958.7613;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Format a mileage for display. Mirrors the rental listing card's formatter so
 * distance reads consistently across the app. Returns null when no distance is
 * available (e.g. the viewer has no saved address).
 */
export function formatDistanceMiles(
  miles: number | null | undefined,
): string | null {
  if (miles == null) return null;
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

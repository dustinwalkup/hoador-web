/**
 * Coarsening for distances we show one member about another member's home.
 *
 * An exact distance is an oracle: a viewer can move their own address at will
 * (`PATCH /api/profile`), so three queries from three chosen points
 * trilaterate a lister's or need-poster's rooftop. Rounding the output alone
 * doesn't stop it, since the attacker can bisect where the rounded value
 * flips. So the TARGET's point is snapped to a grid cell before any distance
 * is computed, and trilateration can only ever converge on the cell (PRIV-02).
 */
import type { LatLng } from "./geo.utils";

/**
 * Grid cell size in degrees: ~400m of latitude, which is coarse enough to
 * defeat rooftop trilateration. The listing search computes distance in SQL
 * and binds this same constant (`listing.dal.ts`), so both paths share a grid.
 */
export const PRIVACY_GRID_DEGREES = 0.0036;

/** Deterministic, not re-rolled per request, so repeated queries can't be
 *  averaged to cancel the offset out — a given target always snaps the same. */
function seededFraction(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 10000) / 10000;
}

/** Snap a TARGET's coordinates to a stable grid cell, salted by their own
 *  user id, so trilateration converges on the cell, never the rooftop. */
export function snapCoordinatesForPrivacy(
  lat: number,
  lng: number,
  targetUserId: string,
): LatLng {
  const latOffset =
    seededFraction(`${targetUserId}:lat`) * PRIVACY_GRID_DEGREES;
  const lngOffset =
    seededFraction(`${targetUserId}:lng`) * PRIVACY_GRID_DEGREES;
  return {
    latitude:
      Math.floor(lat / PRIVACY_GRID_DEGREES) * PRIVACY_GRID_DEGREES + latOffset,
    longitude:
      Math.floor(lng / PRIVACY_GRID_DEGREES) * PRIVACY_GRID_DEGREES + lngOffset,
  };
}

/** Round up to 0.5 mi steps (min 0.5) — defense in depth + a nicer value. */
export function bucketDistanceMiles(miles: number): number {
  return Math.max(0.5, Math.ceil(miles / 0.5) * 0.5);
}

import { describe, it, expect } from "vitest";
import {
  bucketDistanceMiles,
  PRIVACY_GRID_DEGREES,
  snapCoordinatesForPrivacy,
} from "../geo-privacy";

const G = PRIVACY_GRID_DEGREES;
/** Center of the grid cell containing `v`, so a nudge stays inside the cell. */
const cellCenter = (v: number) => (Math.floor(v / G) + 0.5) * G;
/** ~10m expressed in degrees of latitude. */
const TEN_METERS = 0.00009;

describe("geo-privacy", () => {
  describe("snapCoordinatesForPrivacy", () => {
    const lat = cellCenter(40.0);
    const lng = cellCenter(-122.41);

    it("is deterministic for the same point and target", () => {
      expect(snapCoordinatesForPrivacy(lat, lng, "user-1")).toEqual(
        snapCoordinatesForPrivacy(lat, lng, "user-1"),
      );
    });

    it("snaps two points 10m apart in the same cell identically", () => {
      expect(
        snapCoordinatesForPrivacy(lat + TEN_METERS, lng - TEN_METERS, "user-1"),
      ).toEqual(snapCoordinatesForPrivacy(lat, lng, "user-1"));
    });

    it("offsets the same raw point differently for different targets", () => {
      expect(snapCoordinatesForPrivacy(lat, lng, "user-1")).not.toEqual(
        snapCoordinatesForPrivacy(lat, lng, "user-2"),
      );
    });

    it("keeps the snapped point inside the target's own cell", () => {
      for (const id of ["user-1", "user-2", "a", "0b6c1d2e-long-uuid-ish"]) {
        const snapped = snapCoordinatesForPrivacy(lat, lng, id);
        expect(snapped.latitude).toBeGreaterThanOrEqual(lat - G / 2);
        expect(snapped.latitude).toBeLessThan(lat + G / 2);
        expect(snapped.longitude).toBeGreaterThanOrEqual(lng - G / 2);
        expect(snapped.longitude).toBeLessThan(lng + G / 2);
      }
    });
  });

  describe("bucketDistanceMiles", () => {
    it.each([
      [0, 0.5],
      [0.01, 0.5],
      [0.5, 0.5],
      [0.51, 1],
      [2.3, 2.5],
      [12.0, 12],
    ])("buckets %s mi to %s mi", (miles, expected) => {
      expect(bucketDistanceMiles(miles)).toBe(expected);
    });

    it("always returns a multiple of 0.5, never below 0.5", () => {
      for (let miles = 0; miles < 20; miles += 0.037) {
        const bucketed = bucketDistanceMiles(miles);
        expect(bucketed).toBeGreaterThanOrEqual(0.5);
        expect((bucketed * 2) % 1).toBe(0);
        expect(bucketed).toBeGreaterThanOrEqual(miles);
      }
    });
  });
});

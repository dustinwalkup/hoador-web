import { describe, it, expect } from "vitest";
import { groupByLocation, OTHER_LOCATION_HEADING } from "../group-by-location";

type C = { name: string; city: string | null; state: string | null };
const ident = (c: C) => c;

describe("groupByLocation", () => {
  it("groups by 'City, State' and alphabetizes within and across groups", () => {
    const items: C[] = [
      { name: "Timber Trace", city: "Kansas City", state: "MO" },
      { name: "Pembroke Court", city: "Leawood", state: "KS" },
      { name: "Foxcroft", city: "Kansas City", state: "MO" },
    ];

    expect(groupByLocation(items, ident)).toEqual([
      {
        heading: "Kansas City, MO",
        items: [
          { name: "Foxcroft", city: "Kansas City", state: "MO" },
          { name: "Timber Trace", city: "Kansas City", state: "MO" },
        ],
      },
      {
        heading: "Leawood, KS",
        items: [{ name: "Pembroke Court", city: "Leawood", state: "KS" }],
      },
    ]);
  });

  it("collects location-less items under 'Other', ordered last", () => {
    const items: C[] = [
      { name: "Mystery HOA", city: null, state: null },
      { name: "Foxcroft", city: "Kansas City", state: "MO" },
    ];

    const groups = groupByLocation(items, ident);
    expect(groups.map((g) => g.heading)).toEqual([
      "Kansas City, MO",
      OTHER_LOCATION_HEADING,
    ]);
  });

  it("supports a nested accessor (e.g. visibility rows)", () => {
    const rows = [
      { community: { name: "Foxcroft", city: "Kansas City", state: "MO" } },
      {
        community: { name: "Sunset Hills", city: "San Francisco", state: "CA" },
      },
    ];

    const groups = groupByLocation(rows, (r) => r.community);
    expect(groups.map((g) => g.heading)).toEqual([
      "Kansas City, MO",
      "San Francisco, CA",
    ]);
  });

  it("falls back to a single field when one is missing", () => {
    const items: C[] = [{ name: "City Only", city: "Olathe", state: null }];
    expect(groupByLocation(items, ident)[0].heading).toBe("Olathe");
  });
});

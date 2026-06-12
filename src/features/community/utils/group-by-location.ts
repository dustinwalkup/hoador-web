/** Minimal shape needed to group/sort an item by its community location. */
export type LocatableCommunity = {
  name: string;
  city: string | null;
  state: string | null;
};

/** A location heading ("City, State") and the items that belong under it. */
export type LocationGroup<T> = {
  heading: string;
  items: T[];
};

/** Items lacking both city and state are collected under this heading, last. */
export const OTHER_LOCATION_HEADING = "Other";

/**
 * Group items under a "City, State" heading, alphabetized by name within each
 * group; groups are ordered alphabetically by heading, with location-less
 * items collected last under {@link OTHER_LOCATION_HEADING}.
 *
 * Shared by the signup community picker and the profile visibility card so the
 * two surfaces stay consistent. `accessor` maps an item to its community fields
 * (the visibility card nests the community under `.community`).
 */
export function groupByLocation<T>(
  items: readonly T[],
  accessor: (item: T) => LocatableCommunity,
): LocationGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const { city, state } = accessor(item);
    const heading =
      [city, state].filter(Boolean).join(", ") || OTHER_LOCATION_HEADING;
    const bucket = groups.get(heading) ?? [];
    bucket.push(item);
    groups.set(heading, bucket);
  }

  return [...groups.entries()]
    .map(([heading, bucket]) => ({
      heading,
      items: [...bucket].sort((a, b) =>
        accessor(a).name.localeCompare(accessor(b).name),
      ),
    }))
    .sort((a, b) => {
      if (a.heading === OTHER_LOCATION_HEADING) return 1;
      if (b.heading === OTHER_LOCATION_HEADING) return -1;
      return a.heading.localeCompare(b.heading);
    });
}

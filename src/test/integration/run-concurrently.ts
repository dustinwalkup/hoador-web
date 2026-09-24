import { expect } from "vitest";

/**
 * Start two operations together and wait for both to settle. Each runs on its
 * own pooled connection, so this is a real race at the database, not two
 * sequential calls.
 */
export async function raceTwo<T>(
  a: () => Promise<T>,
  b: () => Promise<T>,
): Promise<{ results: PromiseSettledResult<T>[] }> {
  const results = await Promise.allSettled([a(), b()]);
  return { results };
}

/** The race invariant: exactly one side won, and the other was refused. */
export function expectExactlyOneFulfilled<T>(
  results: PromiseSettledResult<T>[],
): { fulfilled: PromiseFulfilledResult<T>; rejected: PromiseRejectedResult } {
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<T> => r.status === "fulfilled",
  );
  const rejected = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(results.length - 1);
  return { fulfilled: fulfilled[0], rejected: rejected[0] };
}

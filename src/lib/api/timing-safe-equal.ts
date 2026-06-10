import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string equality for secret comparison.
 * Length mismatch returns false without leaking timing on the contents.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

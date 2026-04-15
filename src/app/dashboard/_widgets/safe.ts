/** Defaults when a widget fetch fails so the rest of the dashboard can render. */
export function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.error("[Dashboard] Widget data fetch failed:", err);
    return fallback;
  });
}

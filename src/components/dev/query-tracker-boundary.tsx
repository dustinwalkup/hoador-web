import { after } from "next/server";
import {
  getQueryCounter,
  queryCounterStorage,
  reportQueryCounter,
  type QueryCounter,
} from "@/db/query-tracker";

/**
 * RSC-side query tracker boundary (Phase 4 / D2a).
 *
 * Seeds a per-request query counter into AsyncLocalStorage via `enterWith`,
 * which mutates the current async context's store so every descendant RSC
 * rendered in the same async chain inherits it. Flush is scheduled via Next's
 * `after()` so the report is emitted after the response is streamed.
 *
 * Route handlers use the parallel ALS path in withRequestLogging — they never
 * reach this component.
 *
 * No-op in production.
 */
export function QueryTrackerBoundary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") return <>{children}</>;

  if (!getQueryCounter()) {
    const counter: QueryCounter = { label, queries: [], startedAt: null };
    queryCounterStorage.enterWith(counter);
    after(() => reportQueryCounter(counter));
  }

  return <>{children}</>;
}

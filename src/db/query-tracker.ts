import { AsyncLocalStorage } from "async_hooks";

/**
 * Dev-mode per-request DB query counter (Phase 4 / D2a).
 *
 * Instruments the Drizzle client at the logger choke point so every query —
 * RSC render, route handler, server action, cron — is attributed to the
 * request that issued it via AsyncLocalStorage. Zero cost in production:
 * the logger hook in src/db/db.ts is only wired in when NODE_ENV !== "production".
 *
 * Wiring:
 *   - Route handlers: runWithQueryCounter is called inside withRequestLogging,
 *     which already wraps 128/131 handlers.
 *   - RSC: each widget/page that fetches data wraps its async body in
 *     runWithQueryCounter("RSC <label>", async () => { ... }). A layout-level
 *     boundary does NOT work — parent layouts don't re-run on soft navigation
 *     and React Suspense spawns child renders in detached async contexts that
 *     don't inherit an `enterWith`-seeded store. Only per-widget `.run()`
 *     scopes survive both constraints.
 */

export const QUERY_WARN_THRESHOLD = 15;

export interface QueryRecord {
  sql: string;
  /** Primary table parsed from the SQL, e.g. "listings", "rental_requests". */
  table: string;
  timestamp: number;
}

export interface QueryCounter {
  label: string;
  queries: QueryRecord[];
  /** Set lazily on first recorded query so construction stays pure. */
  startedAt: number | null;
}

export const queryCounterStorage = new AsyncLocalStorage<QueryCounter>();

function isEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getQueryCounter(): QueryCounter | undefined {
  return queryCounterStorage.getStore();
}

/**
 * Extracts the primary table from a SQL string. Looks at `FROM <table>` first
 * (the driving table of the query); falls back to `UPDATE`, `INSERT INTO`, and
 * `DELETE FROM` for write statements. Returns a lowercased table name or a
 * short tag like `_tx`/`_other` for non-matching statements (BEGIN, COMMIT,
 * SET, SELECT 1, etc).
 *
 * Handles double-quoted, backtick, schema-qualified, and bare identifiers.
 * Bundler-agnostic — doesn't rely on stack traces, which Turbopack obliterates.
 */
function parseTable(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) return "_other";

  const first = trimmed.split(/\s+/, 1)[0]?.toLowerCase();
  if (first === "begin" || first === "commit" || first === "rollback") {
    return "_tx";
  }

  const identifier = `(?:"([^"]+)"|\`([^\`]+)\`|([a-zA-Z_][\\w]*))`;
  const schemaAndTable = `(?:(?:${identifier})\\s*\\.\\s*)?${identifier}`;

  const patterns = [
    new RegExp(`\\bfrom\\s+${schemaAndTable}`, "i"),
    new RegExp(`\\bupdate\\s+${schemaAndTable}`, "i"),
    new RegExp(`\\binto\\s+${schemaAndTable}`, "i"),
    new RegExp(`\\bdelete\\s+from\\s+${schemaAndTable}`, "i"),
  ];

  for (const re of patterns) {
    const m = trimmed.match(re);
    if (!m) continue;
    // Groups 1-3 = schema (quoted/backtick/bare), 4-6 = table.
    const table = m[4] ?? m[5] ?? m[6];
    if (table) return table.toLowerCase();
  }

  return "_other";
}

export function recordQuery(sql: string): void {
  const counter = queryCounterStorage.getStore();
  if (!counter) return;
  const now = Date.now();
  if (counter.startedAt === null) counter.startedAt = now;
  counter.queries.push({
    sql,
    table: parseTable(sql),
    timestamp: now,
  });
}

/**
 * Run fn with a fresh query counter bound to ALS. On completion, emit the
 * report to the console. Safe to nest — inner calls overwrite the outer label
 * for their subtree but share no state. No-op in production.
 */
export async function runWithQueryCounter<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isEnabled()) return fn();

  const counter: QueryCounter = {
    label,
    queries: [],
    startedAt: null,
  };

  try {
    return await queryCounterStorage.run(counter, fn);
  } finally {
    reportQueryCounter(counter);
  }
}

/**
 * Format + print the counter report. Exported so RSC flush component can call
 * it from Next's after() hook (where the ALS context has already unwound).
 */
export function reportQueryCounter(counter: QueryCounter): void {
  if (!isEnabled()) return;
  const count = counter.queries.length;
  if (count === 0) return;
  const durationMs =
    counter.startedAt !== null ? Date.now() - counter.startedAt : 0;

  const byTable = new Map<string, number>();
  for (const q of counter.queries) {
    byTable.set(q.table, (byTable.get(q.table) ?? 0) + 1);
  }
  const breakdown = [...byTable.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");

  const header = `[query-tracker] ${counter.label} — ${count} queries, ${durationMs}ms`;

  if (count > QUERY_WARN_THRESHOLD) {
    console.warn(
      `${header}  ⚠ exceeds threshold (${QUERY_WARN_THRESHOLD})\n${breakdown}`,
    );
  } else {
    console.debug(`${header}\n${breakdown}`);
  }
}

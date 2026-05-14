/**
 * Captures EXPLAIN (ANALYZE, BUFFERS) for the visibility-aware listing
 * search query. Verifies the planner uses `listings_community_id_idx` for the
 * viewer-side community filter and the `community_visibility_user_community_idx`
 * unique index for the owner-side point lookup, and records p50/p95 timings.
 *
 * Visibility model (R5, symmetric): a listing surfaces only through its own
 * community — the viewer must be visible in `listings.community_id` AND the
 * owner must be visible in that same community.
 *
 * Usage: tsx scripts/explain-search-listings.ts
 *   Optional env: VIEWER_USER_ID=<id>  (otherwise auto-picks a user with
 *                 a primary membership)
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const TRIALS = 10;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length)),
  );
  return sorted[idx];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString, max: 1 });

  try {
    // Pick a viewer with at least one visible community (or use override)
    const viewerId = process.env.VIEWER_USER_ID
      ? process.env.VIEWER_USER_ID
      : (
          await pool.query<{ user_id: string }>(`
            SELECT user_id
              FROM community_visibility
             WHERE is_visible = true
             GROUP BY user_id
             ORDER BY COUNT(*) DESC
             LIMIT 1
          `)
        ).rows[0]?.user_id;

    if (!viewerId) {
      console.error(
        "No viewer found with visibility rows. Has Migration B run?",
      );
      process.exit(1);
    }

    const visibleRows = await pool.query<{ community_id: string }>(
      `SELECT community_id FROM community_visibility
        WHERE user_id = $1 AND is_visible = true`,
      [viewerId],
    );
    const visibleIds = visibleRows.rows.map((r) => r.community_id);
    console.log(
      `Viewer: ${viewerId} | visible communities: ${visibleIds.length}`,
    );

    // Mirrors the searchListings query: data path with no filters, sort by
    // newest, no distance. The community_visibility join is pinned to the
    // owner AND the listing's community (1:1 with the listing); the viewer-side
    // filter is on l.community_id.
    const sql = `
      SELECT DISTINCT
        l.id, l.name, l.daily_rate, l.created_at,
        u.id AS owner_id, u.first_name, u.last_name,
        lc.id AS category_id, lc.name AS category_name
        FROM listings l
        INNER JOIN listing_categories lc ON l.category_id = lc.id
        INNER JOIN "user" u ON l.owner_id = u.id
        INNER JOIN community_visibility cv
          ON cv.user_id = l.owner_id AND cv.community_id = l.community_id
       WHERE l.status IN ('available', 'rented')
         AND l.is_active = true
         AND l.community_id = ANY($1::uuid[])
         AND cv.is_visible = true
         AND l.approval_status = 'approved'
         AND l.owner_id != $2
       ORDER BY l.created_at DESC
       LIMIT 12 OFFSET 0
    `;

    // Warm cache
    await pool.query(sql, [visibleIds, viewerId]);

    // EXPLAIN (ANALYZE, BUFFERS)
    console.log("\n--- EXPLAIN (ANALYZE, BUFFERS) ---");
    const explain = await pool.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
      [visibleIds, viewerId],
    );
    for (const row of explain.rows) console.log(row["QUERY PLAN"]);

    // Timing trials
    const timings: number[] = [];
    for (let i = 0; i < TRIALS; i++) {
      const start = performance.now();
      await pool.query(sql, [visibleIds, viewerId]);
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    console.log(`\n--- Timings over ${TRIALS} trials (ms) ---`);
    console.log(`min:  ${timings[0].toFixed(2)}`);
    console.log(`p50:  ${percentile(timings, 50).toFixed(2)}`);
    console.log(`p95:  ${percentile(timings, 95).toFixed(2)}`);
    console.log(`max:  ${timings[timings.length - 1].toFixed(2)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "src/db/migrations/0059_multi_community_backfill.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf-8");

const KC_METRO_COMMUNITIES = [
  "Glen Arbor Estates",
  "Foxcroft",
  "Timber Trace",
  "Blue Hills Estates",
  "Redbridge North",
  "Verona Gardens",
  "Redbridge Estates",
  "Leawood Estates",
];

describe("0059 multi-community backfill — SQL idempotency guards", () => {
  it("guards community_networks insert with ON CONFLICT (slug) DO NOTHING", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO "community_networks"[\s\S]+ON CONFLICT \("slug"\) DO NOTHING/,
    );
  });

  it("guards community insert with WHERE NOT EXISTS scoped to network_id", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO "communities"[\s\S]+WHERE NOT EXISTS/,
    );
    expect(migrationSql).toMatch(/c\."network_id" = kc\.id/);
  });

  it("gates the membership UPDATE on un-backfilled rows only", () => {
    expect(migrationSql).toMatch(
      /UPDATE "community_memberships"[\s\S]+WHERE "is_primary" = false[\s\S]+AND "verification_status" = 'pending'/,
    );
  });

  it("preserves verified_at when re-running (COALESCE)", () => {
    expect(migrationSql).toMatch(
      /"verified_at" = COALESCE\("verified_at", "created_at"\)/,
    );
  });

  it("guards visibility insert with ON CONFLICT (user_id, community_id)", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO "community_visibility"[\s\S]+ON CONFLICT \("user_id", "community_id"\) DO NOTHING/,
    );
  });

  it("seeds all 8 KC Metro communities", () => {
    for (const name of KC_METRO_COMMUNITIES) {
      expect(migrationSql).toContain(name);
    }
  });

  it("scopes visibility backfill to networked + active communities", () => {
    expect(migrationSql).toMatch(/c\."is_active" = true/);
    expect(migrationSql).toMatch(/mc\."network_id" IS NOT NULL/);
  });
});

// Runtime idempotency check — opt-in via RUN_DB_INTEGRATION=1.
// Requires a Postgres reachable via DATABASE_URL with the 0058 schema applied.
// Wraps everything in a transaction that rolls back, so production data is
// never modified.
const dbReady = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!dbReady)(
  "0059 multi-community backfill — runtime idempotency",
  () => {
    it("re-running the backfill leaves all row counts unchanged", async () => {
      const { db } = await import("@/db/db");
      const { sql } = await import("drizzle-orm");

      const statements = migrationSql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      const countTables = async (tx: { execute: typeof db.execute }) => {
        const tables = [
          "community_networks",
          "communities",
          "community_memberships",
          "community_visibility",
        ] as const;
        const counts: Record<string, number> = {};
        for (const t of tables) {
          const result = (await tx.execute(
            sql.raw(`SELECT COUNT(*)::text AS count FROM "${t}"`),
          )) as unknown as {
            rows?: Array<{ count: string }>;
          } & Array<{ count: string }>;
          // node-postgres returns { rows: [...] }; some drivers return an array directly.
          const row = result.rows?.[0] ?? result[0];
          counts[t] = Number(row?.count ?? 0);
        }
        return counts;
      };

      // db.transaction rolls back on thrown error or explicit rollback.
      await expect(
        db.transaction(async (tx) => {
          for (const stmt of statements) {
            await tx.execute(sql.raw(stmt));
          }
          const afterFirst = await countTables(tx);

          for (const stmt of statements) {
            await tx.execute(sql.raw(stmt));
          }
          const afterSecond = await countTables(tx);

          expect(afterSecond).toEqual(afterFirst);

          // Force rollback so the test never persists data.
          throw new Error("__rollback__");
        }),
      ).rejects.toThrow("__rollback__");
    });
  },
);

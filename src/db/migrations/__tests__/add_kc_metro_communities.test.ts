import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "src/db/migrations/0064_add_kc_metro_communities.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf-8");

// "Hunter's Ridge" appears as 'Hunter''s Ridge' (SQL-escaped apostrophe).
const NEW_KC_METRO_COMMUNITIES = [
  "Sommerset Valley",
  "Woods of Sommerset",
  "Wellington Green",
  "Huntington Place",
  "Innsbrook",
  "Newcastle",
  "Red Bridge Gardens",
  "Pembroke Court",
  "Oxford Hills",
  "Oxford Hills West",
  "Bradford Place",
  "Hunter''s Ridge",
  "Foxborough",
];

describe("0064 add KC Metro communities — SQL idempotency guards", () => {
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

  it("adds all 13 new KC Metro communities", () => {
    for (const name of NEW_KC_METRO_COMMUNITIES) {
      expect(migrationSql).toContain(name);
    }
  });

  it("inserts zip codes where known", () => {
    expect(migrationSql).toMatch(/INSERT INTO "communities"[\s\S]+"zip"/);
    expect(migrationSql).toContain("'64145'");
    expect(migrationSql).toContain("'64146'");
    expect(migrationSql).toContain("'66209'");
  });

  it("guards visibility insert with ON CONFLICT (user_id, community_id)", () => {
    expect(migrationSql).toMatch(
      /INSERT INTO "community_visibility"[\s\S]+ON CONFLICT \("user_id", "community_id"\) DO NOTHING/,
    );
  });

  it("scopes visibility backfill to networked + active communities", () => {
    expect(migrationSql).toMatch(/c\."is_active" = true/);
    expect(migrationSql).toMatch(/mc\."network_id" IS NOT NULL/);
  });
});

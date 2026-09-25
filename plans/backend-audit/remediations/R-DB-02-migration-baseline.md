# Plan R-DB-02: Squash the migration history to a rebuildable baseline

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/db/migrations src/db/schemas drizzle.config.ts package.json .github/workflows/ci.yml .github/workflows/database.yml scripts/e2e-setup.ts scripts/e2e-push.ts scripts/e2e-migrate.ts`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Status**: DEFERRED (2026-09-25) until every earlier migration is in prod; see Findings below
- **Priority**: P2 · **Effort**: L · **Risk**: MED · **Depends on**: none —
  this is Phase 2's first item; other Phase 2 plans that add a migration
  depend on it (they take "the next free number after DB-02's baseline")
- **Category**: database / migrations / CI · **Planned at**: commit
  `29fe557`, 2026-09-25
- **Fixes**: DB-02

## Findings from the 2026-09-25 attempt (read first)

This plan was implemented on 2026-09-25 and then rolled back: **prod is an
existing database, not a new one.** So prod needs the same catalog diff, drift
fix and mark-applied row as dev and staging, and marking any environment is
only safe once it's at the same migration as the others (otherwise the
baseline silently skips what it's missing). Run this plan after every earlier
migration is in prod. Ignore "Production cutover" below where it treats prod
as empty.

The hand-written pieces are in `R-DB-02-attempt-2026-09-25.patch` (this
folder): the `applyBaselineCustomSql` test helper, `communities-real.seed.ts`,
the seed idempotency test, both READMEs, the repointed integration tests, and
the `ci.yml`/`package.json` edits. Regenerate `0000` rather than reusing one;
the schema will have moved.

What the attempt found, beyond this plan:

- **PostGIS 3.5 is on dev and staging, installed by hand.** No migration
  creates it, and search's `ST_Distance` needs it. The attempt used three
  baseline files: `0000` generated; `0001_postgis_extension`
  (`CREATE EXTENSION IF NOT EXISTS postgis`); `0002_baseline_custom_objects`
  (the idempotent SQL in Step 4). They're split because the integration tests
  run `0002` against plain postgres:16, which has no PostGIS. Mark-applied
  then uses `0002`'s `when`. CI's `migrate-empty-db` needs
  `postgis/postgis:16-3.5`.
- **`payments_rental_xor_service_booking_chk`** (hand-added in `0031`) isn't
  in `schema.ts`, so a squash drops it. Declare it in `payments.schema.ts`
  with `check()` as part of the squash (in the patch). Not before: on its own
  it makes the next `db:generate` emit an `ADD CONSTRAINT` that fails where
  it already exists.
- **Step 4b's catalog diff (dev and staging, 2026-09-25) wasn't clean.** Both
  had the pre-#147 `reviews` and `service_reviews` tables (dropped from the
  schema in `cd6aeb2` with no `DROP` migration; test data only, 23 and 27
  rows, all FKs cascade; the maintainer decides whether to drop them), and
  two FKs with Postgres-default names (`messages_service_listing_id_fkey`,
  `review_events_actor_user_id_fkey`; fix with `ALTER TABLE … RENAME
CONSTRAINT` to drizzle's names). Staging was also missing the
  `service_agreement_documents_service_booking_id_unique` constraint (its
  table was empty). Enums (including label order) and extensions matched.
  Check prod the same way.
- **The catalog query truncates long names.** `regclass::text || '.' ||
conname` is a `name`, cut at 63 characters. Cast `conname::text` and
  `tgname::text` (already fixed in Step 4b below).
- **The KC Metro seed list was missing Verona Hills** (moved in by `0061`;
  real users belong to it). That's fixed already, in `communities.seed.ts`.
- **`database.yml`** (Step 7) already landed: no `push`, and `seed` refuses
  production.
- `drizzle.config.ts` console.logs the full `DATABASE_URL`, password included,
  on every drizzle-kit command. Redact the output, or remove the log.

## Why this matters

`bun run db:migrate` cannot rebuild the schema from an empty Postgres today:
`0000_setup_fields.sql` is a no-op guarded by `IF EXISTS (... table_name =
'listings')`, and no later migration creates the base tables (`user`,
`listings`, `rentals`, `payments`, …) — they predate migration 0000 and only
exist because every real environment was bootstrapped some other way (a
manual schema load, or `db:push`, which is exactly the ambiguity Open
question 2 flags: "has `db:push` ever been run against prod?"). Two
migrations are also silently wrong: `0015_sturdy_phantom_reporter.sql` (the
`legal_documents` composite PK) is missing from `meta/_journal.json` and has
never run on any real database; `0017_add_dispute_reference_number.sql`'s
journal `when` (2025-01-26) is earlier than `0016`'s (2026-01-25), so
drizzle-kit's migrator skips it on every environment, and `0018` re-adds the
same column as a plain `serial` instead. And `.github/workflows/database.yml`
offers `push` against `production` from a manual dropdown, with nothing
stopping that operation+environment combination.

None of this is attacker-exploitable. It is disaster-recovery and
new-environment risk: today, only a database that already has the full
migration history applied (dev, staging) — or one bootstrapped by hand or
via `push` — is trustworthy. A fresh environment built with `bun run
db:migrate` alone gets a broken schema, and R-ARCH-06's CI gate for exactly
this (`migrate-empty-db`) had to ship `continue-on-error: true` because it
fails today.

## Current state

- `src/db/migrations/meta/_journal.json` has 78 entries, idx 0–77, tags
  `0000_setup_fields` through `0077_deposit_hold_placing`. Idx 15 is only
  `0015_hesitant_obadiah_stane` (`when: 1768765995427`) — the file
  `0015_sturdy_phantom_reporter.sql` exists on disk but is **not** in any
  journal entry, so `drizzle-kit migrate` never reads it, ever.
- `0017_add_dispute_reference_number.sql`'s journal entry (idx 17)
  is `"when": 1737878400000`, earlier than idx 16's `1769375611862`. `0018`'s
  entry (idx 18) is `"when": 1769402661232`.
- `node_modules/drizzle-orm/pg-core/dialect.js`'s `PgDialect.migrate` (the
  code both `drizzle-kit migrate` and the ORM's own `migrate()` share) is the
  mechanism, read directly (this repo pins `drizzle-kit@0.31.10`,
  `drizzle-orm@0.45.2`):

  ```js
  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsSchema)}.${sql.identifier(migrationsTable)} (
      id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
    )`;
  // migrationsSchema defaults to "drizzle", migrationsTable to "__drizzle_migrations"
  const dbMigrations = await session.all(
    sql`select id, hash, created_at from ${schema}.${table} order by created_at desc limit 1`,
  );
  const lastDbMigration = dbMigrations[0];
  await session.transaction(async (tx) => {
    for await (const migration of migrations) {
      if (
        !lastDbMigration ||
        Number(lastDbMigration.created_at) < migration.folderMillis
      ) {
        for (const stmt of migration.sql) await tx.execute(sql.raw(stmt));
        await tx.execute(sql`insert into ${schema}.${table} ("hash","created_at")
          values(${migration.hash}, ${migration.folderMillis})`);
      }
    }
  });
  ```

  and `node_modules/drizzle-orm/migrator.js`'s `readMigrationFiles`:

  ```js
  hash: crypto.createHash("sha256").update(query).digest("hex"); // query = the RAW file text, including every `--> statement-breakpoint`
  folderMillis: journalEntry.when;
  ```

  Two facts this plan depends on: (1) **only the single row with the highest
  `created_at` is ever read** (`order by created_at desc limit 1`) — the
  table's full history is irrelevant to what runs next; (2) **the hash is
  never checked against anything** — it is written and never read back by
  `migrate`. This means "mark a migration applied without running it" is
  exactly: insert one row into `drizzle.__drizzle_migrations` with
  `created_at` = that migration's journal `when` and `hash` = `sha256` of its
  `.sql` file's exact bytes. Every earlier migration is skipped automatically
  (its `folderMillis` is less than the inserted row's `created_at`); every
  later migration still runs normally (its `folderMillis` exceeds it).
  Confirmed against the installed version by reading the file directly, not
  the docs.

- `drizzle-kit check` (`node_modules/.bin/drizzle-kit check --help`) takes
  only `--out`/`--dialect`/`--config` — **no DB connection flags**. It
  validates the local migrations folder's internal consistency (e.g.
  conflicting snapshots from a concurrent `generate`), not drift between the
  live database and the tracked schema. It cannot be used to detect prod's
  actual drift.
- `drizzle-kit introspect` (alias `pull`) does take `--url` and emits
  TypeScript schema files from a live database — this is the tool for
  Step 1's drift check.
- **Custom SQL not expressible via `drizzle-kit generate`** (verified: no
  `drizzle-kit` source file mentions `EXCLUDE`, and a snapshot diff between
  `0071_snapshot.json`/`0072_snapshot.json` is byte-identical except for the
  snapshot `id`/`prevId` — the exclusion constraint left **no trace** in the
  tracked schema state):
  - `0072_rental_requests_no_overlap.sql`: `CREATE EXTENSION IF NOT EXISTS
btree_gist;` then an `EXCLUDE USING gist (...)` constraint on
    `rental_requests`. The file's own comment says "Not expressible in the
    Drizzle schema; it lives only here." Also confirmed: `drizzle-kit`'s
    snapshot schema (`{id, prevId, version, dialect, tables, enums, schemas,
sequences, roles, policies, views, _meta}`) has **no key for extensions or
    exclusion constraints at all** — `generate`, `push` and `introspect` all
    share this snapshot shape, so none of them can represent either object.
  - `0070_seed_system_user.sql`: `INSERT INTO "user" (...) VALUES ('system',
...) ON CONFLICT ("id") DO NOTHING;` — a data row, not schema. R-BIZ-06
    depends on this row existing (the chargeback auto-dispute FK target).
- **Every other object the history created is in `schema.ts`** and so is
  carried by the generated `0000`: `0075`'s `rate_limit_buckets` table is
  `src/db/schemas/rate-limit.schema.ts:9`; `0044`'s `DO $$` block is only an
  idempotent guard around an ordinary FK; `0038`/`0039` create and drop a
  smoke-test table (net zero). A full grep for `EXTENSION|FUNCTION|TRIGGER|
EXCLUDE|VIEW|POLICY|SEQUENCE|COMMENT ON` across `src/db/migrations/*.sql`
  finds no trigger, function, view, policy or comment anywhere; the only
  hand-made sequence is `0017`'s, which never ran (`0018`'s `serial` creates
  the same `disputes_reference_number_seq` name). Step 4b's catalog diff
  proves this against dev and staging rather than trusting the grep.
- **Enum values need no special handling.** Every `ALTER TYPE ... ADD VALUE`
  in the history (`0015_hesitant`, `0016`, `0021`, `0028`, `0030`, `0031`,
  `0052`, `0053`, `0066`, `0074`, `0077`) converges to the
  _final_ value list already declared in `src/db/schemas/_enums.ts`; a fresh
  `CREATE TYPE ... AS ENUM(...)` generated from that file reproduces the
  final state in one statement, with no incremental `ADD VALUE` at all — so
  the "`ALTER TYPE` can't run in the same transaction it's used in" hazard
  0066 warns about (real: `drizzle-kit migrate` wraps the **entire batch** in
  one `session.transaction`, confirmed above; PG 12+ allows `ADD VALUE`
  inside a transaction but forbids using the new value in that same
  transaction) does not apply to a from-scratch baseline. It stays a live
  hazard for _future_ migrations that both add and use an enum value in
  migrations landing in the same `db:migrate` batch — noted in Maintenance
  notes, not fixed here (not in the finding's recommended-fix list). One
  real caveat: several of those used `ADD VALUE ... BEFORE`, and the rest
  appended at the end, so the live **sort order** of an enum on dev/staging
  can differ from the order `_enums.ts` declares (which is what a fresh
  `CREATE TYPE` uses). That only matters for `ORDER BY`/`<` on an enum
  column, but Step 4b's catalog diff compares labels in `enumsortorder`
  order so any difference is seen, not assumed away.
- **Five test files read archived migration files by path** and break the
  moment Step 2 moves them (`readFileSync` throws at module load):
  - `src/features/rentals/services/__tests__/rental-approval-overlap.integration.test.ts:68`
    runs `0072_rental_requests_no_overlap.sql` against the push-built test DB
    when the constraint is missing (`db:push` never creates it).
  - `src/services/stripe/__tests__/chargeback-system-user.integration.test.ts:43`
    runs `0070_seed_system_user.sql` after each truncate (`seedSystemUser`).
  - `src/db/schemas/__tests__/services-phase1-schema.test.ts:36,51` greps
    `0030_lucky_la_nuit.sql` and `0046_service_payment_lifecycle.sql` for
    index names.
  - `src/db/migrations/__tests__/add_kc_metro_communities.test.ts:7` and
    `multi_community_backfill.test.ts:7` pin the SQL text of `0064`/`0059`.

  The two integration tests need the SQL to keep existing and to be safe to
  run repeatedly against one shared DB (`fileParallelism: false`, truncates
  don't drop constraints). The chargeback test runs the **whole** file each
  time, so once both objects share `0001`, a plain `ADD CONSTRAINT` would
  fail with "already exists" on its second run. Step 4 therefore makes the
  constraint half of `0001` idempotent. The other three files pin text of
  migrations that will never run again and are deleted in Step 2.

- `drizzle-kit introspect` with **any** CLI flag and no `--config` runs in
  "cli" mode (`assertCollisions`, `node_modules/drizzle-kit/bin.cjs`), which
  requires `--dialect` and `--url`; with no flags at all it reads
  `drizzle.config.ts`, whose `out` is `./src/db/migrations`, and writes
  `schema.ts`, `relations.ts` **and a `0000` migration + snapshot into the
  live migrations folder**. Step 1 therefore always passes all three of
  `--dialect postgresql --url ... --out /tmp/...`.
- **`check()` constraints are expressible and already correct.** `grep -rn
"check(" src/db/schemas` finds exactly two:
  `disputes.schema.ts:71` (`disputes_rental_xor_service_booking_ck`) and one
  in `blind-reviews.schema.ts`. `generate` reproduces both from schema.ts
  with no special handling.
- **`legal_documents`'s composite PK and `disputes.reference_number` are
  already correct in schema.ts** — `legal-documents.schema.ts:35`:
  `primaryKey({ columns: [table.id, table.version] })` (0015_sturdy's never-applied
  intent, already satisfied structurally because every snapshot from 0016
  onward already encoded it); `disputes.schema.ts:34`:
  `referenceNumber: serial("reference_number")` (0018's actual real-world
  effect, since 0017 never ran anywhere). A `generate`-built baseline
  reproduces both correctly with zero extra work.
- **Reference/seed data that migrations 0033–0037, 0042, 0043 (listing
  categories), 0034 (service categories) and 0059–0061, 0064 (community
  networks/communities/visibility) originally wrote is already reproducible
  from code that is not a migration:**
  - `src/db/seeds/listings.seed.ts:674` inserts `listingCategories` from its
    own `categories` array — this is what `bun run seed` (the full,
    destructive dev/e2e bootstrap: `src/db/seeds/seed.ts` truncates every
    table first) uses today.
  - `src/db/seeds/service-categories.seed.ts` is a standalone, idempotent
    upsert-by-name script (`bun run seed:service-categories`) already safe to
    run against an empty table.
  - `src/db/seeds/fix-listing-categories.seed.ts` (`CORRECT_CATEGORIES`, a
    hardcoded list matching the final IDs 0033–0037/0042/0043 converged on)
    is also upsert-by-name/insert-if-missing — safe on an empty table despite
    its "fix" name, but has **no standalone package.json script** (only
    reachable via `tsx src/db/seeds/fix-listing-categories.seed.ts` directly).
  - `src/db/seeds/communities.seed.ts` seeds **both** the real KC-Metro
    community list (`KC_METRO_COMMUNITIES`) **and** a `TEST_NETWORK_COMMUNITIES`
    fixture set in the same file — it has no standalone script either (only
    reachable via `bun run seed`, which also truncates and seeds fake
    rentals/payments/messages).
  - None of this data is in scope to bake into the SQL baseline (see Decision 2) — reference data belongs in seed scripts, not migrations, and the
    existing scripts already do the job; they are just under-documented as
    the disaster-recovery path.
- **Pure backfills on pre-existing rows — no baseline equivalent needed** (a
  fresh, empty table has nothing for these to correct): `0000` (no-op DO
  block, schema.ts already has the columns), `0005`, `0007`, `0015_hesitant`'s
  `UPDATE`, `0017` (superseded, never ran), `0023`, `0046`'s backfill
  `INSERT`, `0047`, `0050`, `0057`, `0062`, `0067`, `0069`. Confirmed by
  reading every migration file (`grep -inE
"^\s*(INSERT|UPDATE|DELETE|DO \$\$|CREATE EXTENSION)"` across
  `src/db/migrations/*.sql`, then reading each hit).
- `scripts/e2e-setup.ts` uses `db:push:e2e` (`drizzle-kit push`), not
  `migrate` — confirmed unaffected by this plan; push diffs schema.ts against
  the live DB and creates nothing this plan doesn't also express in
  schema.ts (the EXCLUDE constraint remains a documented gap for local e2e,
  per `13-production-cutover.md`'s existing "Standing rules" — out of scope
  here). `test:integration` and CI's `test` job also build their DB with
  `db:push:e2e`, so they are unaffected too, apart from the two test files
  above. `db:migrate:e2e` (`scripts/e2e-migrate.ts`: `npx drizzle-kit
migrate` with `.env.test`'s `DATABASE_URL`; `drizzle.config.ts`'s
  `dotenv.config({path: ".env.local"})` does not override an already-set
  var) goes from broken to working on an **empty** local DB. On a local DB
  that was already built by `db:push:e2e` it fails at `0000`'s first
  `CREATE TYPE` (type exists) and rolls back, harmlessly; on one that still
  has old `__drizzle_migrations` rows from an earlier `db:migrate:e2e`, same
  result. The fix for either is `docker compose down -v && docker compose
up -d`. No script is referenced by CI with `migrate`.
- `drizzle-kit migrate` against a `postgresql://` URL picks the `pg` driver
  (installed; `bin.cjs` checks `pg` before `@neondatabase/serverless`), so
  the `node-postgres` migrator and thus `PgDialect.migrate` above is the code
  that runs, on Neon and in CI alike.
- `.github/workflows/database.yml`: manual `workflow_dispatch` with
  `operation: [migrate, generate, push, seed]` and `environment: [staging,
production]` as two independent dropdowns — any operation can target either
  environment, so `push` + `production` is a selectable, unguarded
  combination today. `push` + `staging` is also selectable, though the
  cutover doc's Standing rules forbid push against staging too. And `seed` +
  either environment runs `bun run seed`, which **truncates every table**
  and loads fake users/rentals/payments (`src/db/seeds/seed.ts`).
- `.github/workflows/ci.yml`'s `migrate-empty-db` job (lines 108-147) already
  exists (added by R-ARCH-06) with `continue-on-error: true` and is **not**
  in `build`'s `needs: [quality, test]` (line 153) — its own comment says to
  remove both once DB-02 lands.

## Decisions for the maintainer

**1. Squash to one baseline vs. fix the existing 78-file history in place.**

- **Option A — fix in place**: journal `0015_sturdy` (or delete it, since its
  effect is already subsumed by every later snapshot), correct `0017`'s
  `when`, and write a new `0000`-equivalent migration that actually creates
  every base table (`user`, `listings`, `rentals`, `payments`, session,
  account, etc. — everything that predates the current `0000`). This keeps
  78+ files and the real history, but doesn't reduce the amount of custom
  work: the base-table migration would _still_ need the same custom/data
  handling this plan already does for 0072/0070 (an exclusion constraint and
  extension can't be expressed by a hand-written base migration any more
  than by a squash), it adds a large, easy-to-get-wrong hand-authored SQL
  file (every table's every column, FK, index, enum — the entire schema,
  written by hand instead of generated), and it does nothing to shrink CI
  time or migration-history noise.
- **Option B — squash (recommended)**: archive the 78 files, generate one
  fresh baseline from `schema.ts` (verified against a live, fully-migrated
  reference DB via `introspect` for drift — see Step 1), hand-append the two
  custom objects. One generated file is far less error-prone than one
  hand-written 2,000+ line file, and it directly satisfies R-ARCH-06's
  `migrate-empty-db` gate and the roadmap's own wording ("Migration
  baseline... squash").

  **Recommendation: Option B.** Steps below assume it.

**2. Reference/seed data (categories, communities): bake into the baseline's
SQL, or keep it in seed scripts?**

- **Option A — keep it in seed scripts (recommended)**: document
  `seed:service-categories`, a new `seed:listing-categories` (rename/repoint
  the existing `fix-listing-categories.seed.ts` script — it already upserts
  by name and is empty-table-safe) and a new `seed:communities-real` (a small
  new script that reuses `communities.seed.ts`'s `KC_METRO_COMMUNITIES` list
  only, not the test-network fixtures) as the disaster-recovery/new-environment
  bootstrap, run after `db:migrate`. Keeps migrations as pure schema, matches
  how the app already treats seed data, and avoids re-exporting live table
  contents by hand.
- **Option B — embed as `INSERT ... ON CONFLICT DO NOTHING` in the baseline's
  custom SQL file** (`pg_dump --data-only --inserts` from staging for
  `listing_categories`, `service_listing_categories`,
  `community_networks`, `communities`): guarantees `db:migrate` alone
  reconstitutes a working environment, but bakes today's exact rows
  (including the KC-Metro/test-network split, which would need manual
  editing anyway) into a migration file, and any future category/community
  change then needs _both_ a data migration _and_ keeping the seed scripts
  in sync — the two-source-of-truth problem the seed scripts already avoid.

  **Recommendation: Option A.** Step 4 documents the sequence. This is a
  smaller gap than the schema-rebuild problem DB-02 is about — dev and
  staging already have this data, and prod bootstrap is not imminent — so it
  is scoped as a documentation step here, not a new production-readiness
  blocker.

**3. `0015_sturdy`/`0017`: journal, delete, or leave archived as-is?**
Since Option B archives the entire pre-baseline history out of drizzle-kit's
`out` path, neither file will ever be read by any tool again — the "journal
it" and "fix the `when`" remedies only matter for a live migration path,
which the squash replaces. **Recommendation: delete `0015_sturdy_phantom_reporter.sql`
from the archive** (it never ran anywhere; keeping a dead, never-applied file
around is misleading) and **add a short note to the archive's README**
explaining the `0017`/`0018` overlap instead of editing `0017`'s `when` (editing
a file nobody will ever execute again has no effect and risks looking like a
live fix). Step 2 does this.

## Commands

| Purpose                  | Command                                                                                             | Expected                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| Typecheck                | `bun run type-check`                                                                                | exit 0                                            |
| Lint                     | `bun run lint`                                                                                      | exit 0                                            |
| Generate                 | `bun run db:generate`                                                                               | one new migration file + journal entry            |
| Custom migration         | `bun run db:generate --custom`                                                                      | one empty numbered file to hand-fill              |
| Introspect (drift check) | `bunx drizzle-kit introspect --dialect postgresql --url "$DATABASE_URL" --out /tmp/db02-introspect` | schema files written to `/tmp` only; diff by hand |
| Catalog fingerprint      | `psql "$URL" -At -F'                                                                                | ' -f /tmp/db02-catalog.sql > /tmp/db02-<env>.txt` | one sorted line per object (Step 4b) |
| Check                    | `bunx drizzle-kit check`                                                                            | exit 0, no conflicting snapshots                  |
| Migrate                  | `bun run db:migrate`                                                                                | applies pending migrations                        |
| Targeted tests           | `bun run test:run src/db`                                                                           | all pass (if any DB-level unit tests exist)       |
| Full tests               | `bun run test:run`                                                                                  | all pass                                          |
| Real-DB tests            | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                           | all pass                                          |
| YAML syntax check        | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/<file>.yml'))"`                    | no error                                          |

## Scope

**In scope**: `src/db/migrations/*.sql` and `src/db/migrations/meta/*`
(archived and replaced), `.github/workflows/ci.yml` (`migrate-empty-db`
job, `build`'s `needs`), `.github/workflows/database.yml` (block prod
`push`), `package.json` (two new/renamed seed scripts), a new
`src/db/seeds/communities-real.seed.ts` or equivalent, `13-production-cutover.md`
(new rows — coordinator wires these in per the shared brief, but list them
here), `10-remediation-roadmap.md` status row. The five test files that
read migration SQL by path (Current state): two repointed at `0001`, three
deleted or trimmed.

**Out of scope**: `scripts/e2e-setup.ts`/`e2e-push.ts`/`e2e-migrate.ts`
(verified unaffected, see Current state; push-based e2e bootstrap is a
separate, already-accepted gap — see `13-production-cutover.md`'s Standing
rules); any application code under `src/` outside `src/db/seeds` and the
test files above; DB-04's enum/backfill work (separate Phase 2 item);
ARCH-04's durable queue.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Steps

### Step 1: Drift check — introspect a fully-migrated reference DB

Point `.env.local` at staging (`ep-polished-tree` — check
`grep ^DATABASE_URL .env.local` first; staging is the closer analog to a
future production launch and has run the full history through `0077`).

```bash
export DATABASE_URL="$(grep ^DATABASE_URL .env.local | cut -d= -f2- | tr -d '"')"
echo "$DATABASE_URL" | grep -o 'ep-[a-z-]*'   # must print ep-polished-tree
bunx drizzle-kit introspect --dialect postgresql --url "$DATABASE_URL" --out /tmp/db02-introspect
```

All three flags are required: with no flags, introspect falls back to
`drizzle.config.ts` and writes into `src/db/migrations/` (Current state).
**Verify** `git status --short src/db` is empty afterwards.

This step is a quick early read. Step 4b is the real gate: it compares a DB
built from the new baseline against dev and staging object by object.

Compare the emitted `schema.ts` structurally against `src/db/schemas/*.ts` —
not byte-for-byte (introspect's generated code style differs from the
hand-written files), but table-by-table: every table, column, FK, and
ordinary index/unique constraint should have a match. Also run these raw
catalog queries against the same reference DB to confirm the two objects
`generate` can never see:

```sql
SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
SELECT conname, contype FROM pg_constraint WHERE conname = 'rental_requests_no_overlap';
SELECT id FROM "user" WHERE id = 'system';
```

Expect: `btree_gist` present, `rental_requests_no_overlap` present with
`contype = 'x'` (exclusion), one `system` user row.

**Verify**: introspect completes with no connection error; every table in
`src/db/schemas/*.ts` has a structural match in `/tmp/db02-introspect`; all
three catalog queries return the expected row.

**STOP condition**: if introspect finds a table, column, or constraint that
exists live but has **no** match anywhere in `schema.ts` and is not one of
the two known-custom objects above — that is undocumented drift beyond what
this plan accounts for. Stop and report it; do not silently drop it from the
baseline.

### Step 2: Archive the old migration history

```bash
mkdir -p src/db/migrations-archive-pre-0000
git mv src/db/migrations/*.sql src/db/migrations-archive-pre-0000/
git mv src/db/migrations/meta src/db/migrations-archive-pre-0000/meta
```

Add `src/db/migrations-archive-pre-0000/README.md`:

```markdown
# Archived pre-baseline migrations (0000–0077)

Superseded by the squashed baseline in `src/db/migrations/` (R-DB-02,
2026-09-25). Kept for history only — drizzle-kit's `out` config
(`drizzle.config.ts`) no longer points here, so nothing in this directory is
ever read by `db:generate`, `db:migrate`, `db:push` or `drizzle-kit check`
again.

Two known bugs in this archived history, never fixed because fixing a file
nobody executes again has no effect:

- `0015_sturdy_phantom_reporter.sql` (the `legal_documents` composite PK) was
  never in `meta/_journal.json` and never ran on any real database. Its
  effect is already present in every snapshot from `0016` onward, and in the
  new baseline.
- `0017_add_dispute_reference_number.sql`'s journal `when` predates `0016`'s,
  so drizzle-kit's migrator always skipped it; `0018_young_amphibian.sql`
  (a plain `serial` column) is what actually ran everywhere and is what the
  new baseline reproduces.
```

Per Decision 3, delete the dead file explicitly rather than leaving it
un-journaled and confusing:

```bash
git rm src/db/migrations-archive-pre-0000/0015_sturdy_phantom_reporter.sql
```

Delete the tests that pin the text of archived migrations (they exercise
files that never run again; the community list they guard is now the
`seed:communities-real` script's job, Step 4):

```bash
git rm -r src/db/migrations/__tests__
```

and in `src/db/schemas/__tests__/services-phase1-schema.test.ts` delete the
whole `describe("services phase 1 migration SQL (index names)", ...)` block
(it reads `0030`/`0046`) and any now-unused `readFileSync`/`join` imports.
The schema-level `describe` above it stays. Leave the two integration tests
for Step 4, which repoints them at `0001`.

**Verify**: `ls -A src/db/migrations` → empty (or absent); `ls
src/db/migrations-archive-pre-0000/*.sql | wc -l` → `78` (79 files on disk:
78 journaled plus the un-journaled `0015_sturdy`, minus the deleted one).
`grep -rn "src/db/migrations/0" src --include=*.ts` → only the two
integration tests (fixed in Step 4).

### Step 3: Generate the baseline schema migration

With `src/db/migrations/` empty, run:

```bash
bun run db:generate
```

drizzle-kit sees no prior snapshot, so it treats `src/db/schemas/*.ts` as the
entire desired state and emits one file, `0000_<generated-name>.sql`, with a
fresh `meta/_journal.json` (one entry, idx 0) and `meta/0000_snapshot.json`.
This is pure DDL: every `CREATE TABLE`, `CREATE TYPE ... AS ENUM(...)` (full
value lists, not incremental `ADD VALUE`), FK, index, unique constraint and
`check()` constraint currently in `schema.ts` — including the composite
`legal_documents` PK and `disputes.reference_number serial` (see Current
state).

**Verify**: `bun run type-check` → exit 0 (schema.ts is unchanged, only the
migrations folder is new). Read the generated SQL file once, end to end —
confirm it contains `CREATE TABLE "user"`, `CREATE TABLE "listings"`, and
every other base table absent from the old `0000_setup_fields.sql`.

### Step 4: Custom baseline migration — the two non-generatable objects, and the seed-data bootstrap sequence

```bash
bun run db:generate --custom
```

names the new file `0001_<name>.sql` (journal idx 1, `when` = current
timestamp). Fill it with exactly the two objects Step 1 confirmed and
nothing else. The SQL is the archived files' SQL, with one change: the
`ADD CONSTRAINT` sits in a `pg_constraint` guard so the whole file is
idempotent. `migrate` never needs that, but the two integration tests run
this file repeatedly against one shared test DB (Current state), and the
chargeback test runs all of it after every truncate.

```sql
-- R-DB-02 baseline: objects drizzle-kit cannot express or track (see
-- src/db/migrations/README.md). From the archived
-- 0072_rental_requests_no_overlap.sql and 0070_seed_system_user.sql.
-- Idempotent on purpose: integration tests run this file by hand against a
-- db:push-built database, which never has the constraint or the row.

-- CONC-01: no two rental requests on one listing may hold the same day while
-- approved, active or overdue. Whole days, inclusive at both ends. See the
-- archived 0072 for the full reasoning.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rental_requests_no_overlap'
  ) THEN
    ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_no_overlap"
      EXCLUDE USING gist (
        "listing_id" WITH =,
        daterange("start_date"::date, "end_date"::date, '[]') WITH &&
      )
      WHERE ("status" IN ('approved', 'active', 'overdue'));
  END IF;
END $$;--> statement-breakpoint

-- BIZ-06: chargeback auto-disputes are created_by = 'system', a FK to
-- "user".id. See the archived 0070 for the original reasoning comment.
INSERT INTO "user" ("id", "name", "email", "status", "user_type", "email_verified")
VALUES ('system', 'System', 'system@invalid.hoador', 'inactive', 'standard', false)
ON CONFLICT ("id") DO NOTHING;
```

Add `src/db/migrations/README.md`:

```markdown
# Migrations

Baseline: `0000` (generated schema) + `0001` (custom — extension, exclusion
constraint, system-user seed; see the file's own comments). Future
migrations start at `0002`.

**A fresh environment is not fully bootstrapped by `db:migrate` alone.**
After migrating, run, in order:

    bun run seed:listing-categories   # idempotent, safe to re-run
    bun run seed:service-categories   # idempotent, safe to re-run
    bun run seed:communities-real     # idempotent, safe to re-run (KC Metro only — no test fixtures)

`bun run seed` (full) additionally truncates every table and seeds fake
users/rentals/payments/messages — dev/e2e only, never run it against a real
environment.

History before this baseline is archived in
`src/db/migrations-archive-pre-0000/` for reference only; nothing in this
repo reads it.
```

Rename the seed script per Decision 2 (the file already does exactly this
job, it is just misleadingly named "fix"):

```bash
git mv src/db/seeds/fix-listing-categories.seed.ts src/db/seeds/listing-categories.seed.ts
```

In `package.json`, replace the `seed:fix-listing-categories` line with:

```json
"seed:listing-categories": "tsx src/db/seeds/listing-categories.seed.ts",
```

and add a new script + file `src/db/seeds/communities-real.seed.ts` for the
KC Metro network and its communities only. `communities.seed.ts` has **no
reusable helpers**: its `main()` does plain, non-idempotent `insert(...)`s of
both networks, then assigns every existing user a membership. So: export
`KC_METRO_COMMUNITIES` and `KC_METRO_SLUG` from `communities.seed.ts` (they
are module-private `const`s today) and write the new script fresh, with the
guards the archived `0059`/`0064` used: the network insert
`.onConflictDoNothing({ target: communityNetworks.slug })` then a select by
slug for its id; each community inserted only `WHERE NOT EXISTS` a row with
the same `name` and `network_id` (`communities.name` has no unique index,
only `communities_name_idx`). No memberships, no visibility rows, no test
network. Add:

```json
"seed:communities-real": "tsx src/db/seeds/communities-real.seed.ts",
```

Before relying on it for prod, confirm the list matches what the archived
migrations actually produced (they added communities in `0059`, `0061` and
`0064`, and the seed file was edited separately): against staging,
`SELECT c.name FROM communities c JOIN community_networks n ON n.id =
c.network_id WHERE n.slug = 'kansas-city-metro' ORDER BY 1;` must equal the
sorted `KC_METRO_COMMUNITIES` names. If not, fix the seed list (staging is
the reference) and say so in the report.

Repoint the two integration tests at the new file (both keep their
existing "run the SQL if missing" shape; the file is idempotent now):

- `rental-approval-overlap.integration.test.ts:68`: `0072_rental_requests_no_overlap.sql` → `0001_<name>.sql`.
- `chargeback-system-user.integration.test.ts:43`: `0070_seed_system_user.sql` → `0001_<name>.sql`.

Better still, add one exported helper in `src/test/integration/` (e.g.
`applyBaselineCustomSql()` that reads the journal's idx-1 tag, so a future
re-squash doesn't break the path again) and call it from both.

**Verify**: `bun run type-check` → exit 0. `grep -rn
"fix-listing-categories" package.json src` → no remaining references (update
any caller). `grep -rn "src/db/migrations/00[0-9][0-9]_" src --include=*.ts`
→ only `0001` (or none, with the helper). `docker compose up -d && bun run
db:push:e2e && bun run test:integration
src/features/rentals/services/__tests__/rental-approval-overlap.integration.test.ts
src/services/stripe/__tests__/chargeback-system-user.integration.test.ts`
→ pass, and pass again on a second run (constraint already present).
`bunx drizzle-kit check` → exit 0 (the custom migration doesn't touch the
tracked snapshot, so nothing to conflict).

### Step 4b: Catalog diff — baseline-built DB vs dev and staging (the drift gate)

Step 1's introspect can't see extensions, exclusion constraints, enum order,
triggers or functions, and a by-eye diff of generated TypeScript misses
small differences (a nullable flag, an `ON DELETE` action, a default). This
step compares the actual catalogs, order-insensitively, and it is what
makes it safe to tell dev and staging "you already have `0000`+`0001`".

1. Build a scratch DB from the new baseline only (never dev/staging):

   ```bash
   docker run -d --name db02-scratch -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
   # wait for pg_isready, then:
   DATABASE_URL=postgresql://postgres:postgres@localhost:55432/postgres bunx drizzle-kit migrate
   ```

   (The env var wins over `drizzle.config.ts`'s `.env.local` load; dotenv
   doesn't override a set var. Echo nothing from `.env.local` here.)

2. Write `/tmp/db02-catalog.sql`, a sorted fingerprint of the `public`
   schema:

   ```sql
   SELECT 'ext', extname, '' FROM pg_extension
   UNION ALL
   SELECT 'col', table_name || '.' || column_name,
          concat_ws('|', udt_name, is_nullable, column_default,
                    character_maximum_length, numeric_precision, numeric_scale)
     FROM information_schema.columns WHERE table_schema = 'public'
   UNION ALL
   SELECT 'con', conrelid::regclass::text || '.' || conname::text, pg_get_constraintdef(oid)
     FROM pg_constraint WHERE connamespace = 'public'::regnamespace
   UNION ALL
   SELECT 'idx', indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
   UNION ALL
   SELECT 'enum', t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname
   UNION ALL
   SELECT 'fn', p.proname, pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
   UNION ALL
   SELECT 'trg', tgrelid::regclass::text || '.' || tgname::text, pg_get_triggerdef(oid)
     FROM pg_trigger WHERE NOT tgisinternal
   UNION ALL
   SELECT 'view', table_name, '' FROM information_schema.views WHERE table_schema = 'public'
   UNION ALL
   SELECT 'seq', sequence_name, '' FROM information_schema.sequences WHERE sequence_schema = 'public'
   ORDER BY 1, 2, 3;
   ```

3. Run it against scratch, dev and staging (check the host each time) and
   diff:

   ```bash
   psql "postgresql://postgres:postgres@localhost:55432/postgres" -At -F'|' -f /tmp/db02-catalog.sql > /tmp/db02-scratch.txt
   psql "$DEV_URL"     -At -F'|' -f /tmp/db02-catalog.sql > /tmp/db02-dev.txt
   psql "$STAGING_URL" -At -F'|' -f /tmp/db02-catalog.sql > /tmp/db02-staging.txt
   diff /tmp/db02-scratch.txt /tmp/db02-dev.txt
   diff /tmp/db02-scratch.txt /tmp/db02-staging.txt
   docker rm -f db02-scratch
   ```

**Verify**: each diff shows only `ext` lines for Neon-managed extensions
(e.g. `plpgsql` is on both; anything Neon adds on its side is expected) and
nothing else. In particular: every `col`, `con` (including
`rental_requests_no_overlap` and both `check` constraints), `idx` and `seq`
line matches, and every `enum` line matches **including label order**.
Also `SELECT id FROM "user" WHERE id = 'system'` returns one row on scratch.

**STOP condition**: any other diff line. A column/constraint/index that
differs means that environment's schema is not what `0000`+`0001` would
build, and marking the baseline applied there (Step 5) would bake the
difference in silently. Report the lines. Typical fixes are a schema.ts
change (the environment is right and the schema file drifted, then
regenerate `0000`) or a one-off corrective SQL on that environment, recorded
as a cutover row; the maintainer chooses. An enum that differs only in label
order is reportable but not blocking unless something orders by it (`grep
-rn "orderBy(.*[Ss]tatus\|ORDER BY.*status" src`).

### Step 5: Mark the baseline applied on dev and staging (cutover, not local)

**Do this only against dev and staging, per Production cutover below — never
locally, and never by running `bun run db:migrate` for the baseline** (that
would try to `CREATE TABLE "user"` etc. against a database that already has
them, and fail). Instead, insert the one row that makes drizzle-kit consider
`0000` and `0001` already applied (see "Current state" — only the single
highest-`created_at` row is ever read):

```bash
# hash = sha256 of migration 0001's exact file bytes; created_at = its journal "when"
HASH=$(shasum -a 256 src/db/migrations/0001_<name>.sql | cut -d' ' -f1)  # macOS has no sha256sum; the hash is never read back, but keep it honest
WHEN=$(python3 -c "import json; print(json.load(open('src/db/migrations/meta/_journal.json'))['entries'][1]['when'])")
```

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<HASH>', <WHEN>);
```

(Dev and staging already have `drizzle.__drizzle_migrations`, since both
were migrated through 0077 on 2026-09-24. **Never run `bun run db:migrate`
against an existing environment before this row is in place**: with the new
folder it would try to apply `0000` against a populated schema. For a
future environment that has the schema but not the table, create it by hand
first, using the DDL `node_modules/drizzle-orm/pg-core/dialect.js` uses:
`CREATE SCHEMA IF NOT EXISTS drizzle; CREATE TABLE IF NOT EXISTS
drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL,
created_at bigint);`. A brand-new empty database (prod at launch, CI's
`migrate-empty-db`) needs no row: `db:migrate` builds it from `0000`.)

Only after Step 4b's diff is clean for that environment.

**Verify** on each environment, immediately after: `SELECT count(*),
max(created_at) FROM drizzle.__drizzle_migrations;` → note it; `bun run
db:migrate` (drizzle-kit prints the same success line whether or not it
ran anything, so don't trust its output); the same query → **unchanged**
count and max (both `0000` and `0001` are skipped because their
`folderMillis` doesn't exceed the inserted row's `created_at`). If the
row were wrong, `0000`'s first `CREATE TYPE` fails on the existing type and
the whole batch rolls back, so the check is safe to run. Then `bunx
drizzle-kit check` → exit 0.

**STOP condition**: if `bun run db:migrate` tries to run `0000` or `0001`
against dev or staging (visible output showing `CREATE TABLE` statements) —
the inserted row's `created_at` or `hash` is wrong, or was inserted against
the wrong database. Stop immediately; do not let it proceed (it would either
fail loudly on `CREATE TABLE "user"` already existing, rolling back the
whole transaction, or — worse — succeed if `IF NOT EXISTS` guards happened
to cover everything, silently masking the mistake). Re-check `grep
^DATABASE_URL .env.local` before retrying.

### Step 6: `ci.yml` — make `migrate-empty-db` blocking, add `drizzle-kit check`

In `.github/workflows/ci.yml`:

- Remove `continue-on-error: true` from `migrate-empty-db` (line 116).
- Update its name/comment (lines 108-114) to drop the "DB-02 tripwire, non-blocking" language.
- `check` is already the job's second step (line 146-147) — leave it, it now
  actually blocks.
- Add `migrate-empty-db` to `build`'s `needs`:

  ```yaml
  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [quality, test, migrate-empty-db]
  ```

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
→ no error. Do not run this job locally against a real database (see STOP
conditions) — CI's next run against an empty `postgres:16` service container
is the real verification.

### Step 7: `database.yml` — remove `push`, keep the destructive `seed` off production

The only environments the dropdown offers are `staging` and `production`,
and the cutover doc's Standing rules forbid `drizzle-kit push` against
**both** (push never creates `rental_requests_no_overlap`, and a push that
disagrees with the migration history is exactly the drift this plan
removes). So a guard for `push` + `production` alone is not enough: delete
the `push` option from `operation.options` and delete the `push-schema`
job outright. `db:push` stays in `package.json` for local use.

`seed` runs `bun run seed`, which truncates every table. Keep it for
staging (it is how staging gets fake data) but make it impossible against
production:

```yaml
seed:
  name: Seed Database
  runs-on: ubuntu-latest
  if: github.event.inputs.operation == 'seed' && github.event.inputs.environment != 'production'
```

plus a guard job so selecting it fails visibly instead of silently doing
nothing:

```yaml
reject-prod-seed:
  name: Block destructive seed on production
  runs-on: ubuntu-latest
  if: github.event.inputs.operation == 'seed' && github.event.inputs.environment == 'production'
  steps:
    - run: |
        echo "::error::'seed' truncates every table. Never on production; use the seed:* reference-data scripts in src/db/migrations/README.md by hand."
        exit 1
```

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/database.yml'))"`
→ no error. `grep -n "push" .github/workflows/database.yml` → no match.
`grep -A3 "^  seed:" .github/workflows/database.yml` shows the narrowed `if:`.

### Step 8: Tests

No unit test exercises `drizzle-kit`'s own migrator (it's a third-party CLI
against a real database) or GitHub Actions' `workflow_dispatch` semantics —
the real verification is Steps 5-7's `Verify` lines plus CI's next run.
Add one thing that _is_ testable: `src/db/seeds/__tests__/reference-seeds.integration.test.ts`
(there is no `src/db/seeds/__tests__` today; the `*.integration.test.ts`
name puts it in `vitest.integration.config.mjs`) asserting
`seed:listing-categories`, `seed:service-categories` and
`seed:communities-real` are each idempotent against an **empty** table. The
seed files call `main()` at import and open their own `pg` pool
(`src/db/db-seed.ts`), so don't import them: truncate the three tables,
then `spawnSync("bunx", ["tsx", "src/db/seeds/<file>"], { env: {
...process.env } })` each script twice (the harness's `DATABASE_URL` wins
over `db-seed.ts`'s `.env.local` load) and assert exit 0 both times and an
unchanged row count after the second run.

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run
test:integration` → includes the new test, passes.

## Test plan

Covered by each step's **Verify** line plus Step 8. There is no way to unit
test "does `drizzle-kit migrate` rebuild an empty database correctly" other
than actually running it — that is what `ci.yml`'s now-blocking
`migrate-empty-db` job does on every push, and what `bun run test:integration`
(via `db:push:e2e`) already exercises for the ordinary-schema half. Full
regression: `bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0
- [ ] `src/db/migrations/` contains exactly `0000_*.sql`, `0001_*.sql`,
      `meta/`, `README.md` — no leftover old-numbered files, no `__tests__/`
- [ ] `src/db/migrations-archive-pre-0000/` contains the other 78 old `.sql`
      files, `meta/`, `README.md`; `0015_sturdy_phantom_reporter.sql` is deleted
- [ ] `grep -rn "src/db/migrations/00" src --include=*.ts` → only `0001`
      (or nothing, with the shared helper); both integration tests pass twice
      in a row against the same test DB
- [ ] Step 4b's catalog diff is clean (only Neon `ext` lines) for dev **and**
      staging before either gets the mark-applied row
- [ ] `0001_*.sql` run twice by hand against a scratch DB → no error
- [ ] A fresh local Postgres migrated with `bun run db:migrate` (not push) —
      only in CI's `migrate-empty-db` job or a scratch container, never
      dev/staging (STOP conditions) — succeeds and `bunx drizzle-kit check`
      passes against it
- [ ] `.github/workflows/ci.yml`: `migrate-empty-db` has no
      `continue-on-error`; `build.needs` includes it
- [ ] `.github/workflows/database.yml`: no `push` option or job; `seed` +
      `production` fails fast with a clear error and never runs `bun run seed`
- [ ] Dev and staging: the mark-applied row is inserted (Step 5), confirmed
      by `bun run db:migrate` reporting nothing pending, immediately after
- [ ] `package.json` has `seed:listing-categories` and
      `seed:communities-real`; `seed:fix-listing-categories` is gone
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2 step 1 / DB-02)

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- Step 1's introspection finds live drift beyond the two known custom
  objects, or Step 4b's catalog diff shows any non-`ext` line for dev or
  staging.
- `git status` shows anything written into `src/db/migrations/` by Step 1's
  introspect (it ran without the explicit flags).
- Step 5's mark-applied insert is about to run, or has run, against the
  wrong database, or `bun run db:migrate` afterward shows pending
  `CREATE TABLE` statements for `0000`/`0001` on dev or staging.
- `bun run db:generate` in Step 3 produces anything touching `--custom`-only
  territory (an unexpected `EXCLUDE`/extension line it invented, which it
  cannot do) — impossible per the snapshot-schema analysis above, but if it
  happens, stop and report rather than accepting an unexplained diff.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No API or contract change — this plan touches only migration tooling, CI,
and seed scripts. No mobile follow-up row.

## Production cutover

**Prod is a brand-new, empty database, so prod never gets a mark-applied
row.** On prod, `bun run db:migrate` runs once and builds everything from
`0000` + `0001` (tables, enums, `btree_gist`, `rental_requests_no_overlap`,
the `system` user), plus any later migrations that exist by then. That
collapses the existing per-migration prod steps into one. The coordinator
applies these edits to `13-production-cutover.md`:

- **Rows M1–M6, prod column**: replace `TODO` with `superseded by R-DB-02
(M0)`. Their dev/staging history stays as the record of what ran there.
  The M1 notes table (`0070_…`, `0072_…`, `0073_…` etc.) becomes history
  too; add a line above it: "Prod: see M0. These files are archived in
  `src/db/migrations-archive-pre-0000/` and never run on prod."
- **New row M0** (above M1): `Prod: bun run db:migrate once on the empty
database, after checking the host (builds 0000+0001 and anything later)` |
  From: R-DB-02 | dev: n/a (marked, see M0a) | staging: n/a (marked, see
  M0a) | prod: TODO. Verify after: `SELECT count(*) FROM
drizzle.__drizzle_migrations` = number of journal entries; A1's
  constraint query returns one row; `SELECT id FROM "user" WHERE id =
'system'` returns one row.
- **New row M0a**: `Mark the baseline (0000+0001) applied without running
it: one INSERT into drizzle.__drizzle_migrations (Step 5), after the
Step 4b catalog diff is clean` | From: R-DB-02 | dev: TODO | staging: TODO
  | prod: **N/A (new database, M0 builds it)**. **Never run `bun run
db:migrate` on dev or staging before this row is in**: it would try to
  apply `0000` to a populated schema (fails and rolls back, but blocks every
  later migration until fixed).
- **New row M0b**: `Bootstrap reference data: bun run
seed:listing-categories, seed:service-categories, seed:communities-real,
in that order, once` | From: R-DB-02 | dev: n/a (already seeded) |
  staging: n/a (already seeded) | prod: TODO, right after M0.
- **Rows that only existed to fix pre-existing prod data become N/A on
  prod** because prod has none: B3 (overlapping bookings before 0072), A2
  (resend chargebacks that failed before the `system` user existed), A3
  (deposits captured before R-BIZ-04). Mark each `N/A (new database)`, as
  A4 already is. B1 (snapshot) is moot on an empty database but harmless.
  A1 (verify the constraint) stays TODO on prod, covered by M0's verify.
- **Standing rules**: change "until you run the 0072 SQL by hand" to "until
  you run `src/db/migrations/0001_*.sql` by hand (idempotent)".
- No data cleanup is needed on dev/staging (nothing runs; the row only
  records that it already did).

## Maintenance notes

- **The single-transaction batch hazard from 0066 is not fixed, only made
  irrelevant for the baseline itself.** A future migration that both adds an
  enum value and writes a row using that new value, landing in the _same_
  `db:migrate` run as another migration, will still fail if `db:migrate` ever
  batches more than one pending migration at once (it always does — the
  whole pending set is one transaction). Land such migrations in separate
  `db:migrate` runs (deploy, then migrate, then deploy the code that uses the
  new value) rather than in the same PR/release.
- **`CREATE INDEX CONCURRENTLY` cannot run via `bun run db:migrate`** for the
  same reason (confirmed directly in `dialect.js`, not inferred): Postgres
  forbids `CONCURRENTLY` inside a transaction block, and drizzle-kit's
  migrator wraps every pending migration in one transaction with no
  per-statement exception. Any future migration needing `CONCURRENTLY` (e.g.
  an index added to a large, already-populated table) must be applied by
  hand (`psql`, autocommit) and then marked applied exactly as Step 5 does,
  never run through `db:migrate`. R-PERF-04's index migrations note this
  explicitly.
- **`drizzle-kit check` still doesn't check live DB drift** — it only
  catches local migrations-folder inconsistency. If a stray `db:push` is ever
  run again against dev/staging/prod outside this process, nothing in CI
  will notice; `migrate-empty-db` only proves the tracked history is
  internally rebuildable, not that a given live database matches it. If that
  becomes a real risk, add a periodic `drizzle-kit introspect` + diff job
  against each real environment — out of scope here.
- **Every environment must get the mark row before its next `db:migrate`**,
  including any Neon branch forked from dev/staging before this lands, and
  any local DB that was migrated rather than pushed (for those, `docker
compose down -v` is simpler).
- `pr-checks.yml`'s size check excludes `src/db/migrations/meta/` but not
  the generated `0000_*.sql` (thousands of lines). If this ever goes through
  a PR to `develop` rather than a direct commit, that check fails; it's
  advisory, not a bug.
- If a future plan needs to re-squash again (e.g. after many more
  migrations accumulate), repeat Steps 1-5 with a new archive directory name
  (`migrations-archive-pre-00NN`) and a new baseline starting at whatever
  number follows the last one issued.

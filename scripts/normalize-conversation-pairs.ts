/**
 * Audit — and optionally normalize — the `(user1_id, user2_id)` ordering on
 * `conversations`.
 *
 * `findOrCreateConversation` writes the pair sorted with JavaScript's
 * `[a, b].sort()`. Rows written anywhere else did not: the messages seed stored
 * `user1Id: user.id, user2Id: otherUser.id` verbatim until this epic fixed it.
 * Unsorted rows are not corrupt — the conversation and its messages are intact
 * — but before P-E11-6 every `conversationId` join on rental and booking detail
 * missed them, and the find-or-create lookup missed them too and inserted a
 * *second* conversation for the same two people (the unique constraint is on
 * the ordered pair, so both rows survive, each holding half the history).
 *
 * Both of those are fixed in code now (symmetric join predicate, symmetric
 * find-or-create lookup), so this script is data hygiene rather than a
 * correctness requirement. Run it against a seeded dev/staging database so the
 * device pass does not meet duplicate threads that look like an app bug.
 *
 * Usage:
 *   bun scripts/normalize-conversation-pairs.ts           # audit only
 *   bun scripts/normalize-conversation-pairs.ts --apply   # rewrite rows (confirms first)
 *   bun scripts/normalize-conversation-pairs.ts --apply --yes   # non-interactive (CI)
 *
 * (`bun`, not `tsx`: `src/db/db.ts` uses top-level await, which tsx's CJS
 * transform rejects.)
 *
 * ⚠️ **There is no way to detect production from the connection string, and this
 * script does not pretend otherwise.** Dev, staging and production are all
 * `neondb` on an opaque `ep-*.neon.tech` host, so any "looks like production"
 * regex would be guesswork wearing the costume of a safety net —
 * `clear-database-complete.ts` can demand `localhost` because it is only ever
 * meant to run there; this one legitimately targets cloud databases.
 * `NODE_ENV` is no better: `bun` leaves it unset, so a production URL pasted on
 * the command line sails straight past that check.
 *
 * What actually protects the operator is **seeing where they are**. The target
 * host and database are printed on every run, credentials stripped, and
 * `--apply` will not write until someone confirms that target — interactively,
 * or with `--yes` where the environment was chosen by something other than a
 * paste (a GitHub Actions `environment:` and its scoped secret).
 *
 * Swapping the pair swaps the per-user columns with it (`userNLastReadAt`,
 * `userNArchived`) so nobody's read state or archive flag moves to the other
 * person.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F20 / P-E11-7
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db/db";

const apply = process.argv.includes("--apply");
const assumeYes = process.argv.includes("--yes");

/**
 * `host/database` for display — **never the credentials**, which is why this
 * builds the label by hand rather than logging the URL. Falls back to a literal
 * when the value is unparseable, so an unreadable target still reads as one
 * rather than as an empty string that looks like localhost.
 */
function describeTarget(url: string): string {
  const match = /^[^:]+:\/\/(?:[^@]*@)?([^/?#]+)(?:\/([^?#]*))?/.exec(url);
  if (!match) return "<unparseable DATABASE_URL>";
  return `${match[1]}/${match[2] || "<no database>"}`;
}

const databaseUrl = process.env.DATABASE_URL;

// `src/db/db.ts` falls back to a mock localhost URL when this is unset, which
// would fail later with a connection error that says nothing about the cause.
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Nothing to audit.");
  process.exit(1);
}

const target = describeTarget(databaseUrl);
console.log(`Target: ${target}\n`);

// Kept, but it is a speed bump rather than a safety net — see the header.
if (process.env.NODE_ENV === "production") {
  console.error("REFUSING to run: NODE_ENV=production.");
  process.exit(1);
}

/**
 * Confirm the target before writing.
 *
 * A non-TTY run without `--yes` **refuses** rather than proceeding: a piped or
 * backgrounded invocation is exactly the case where nobody is reading the
 * target line above, so silently continuing would defeat the point.
 */
function confirmTarget(): boolean {
  if (assumeYes) {
    console.log(`--yes given; writing to ${target} without confirmation.\n`);
    return true;
  }
  if (!process.stdin.isTTY) {
    console.error(
      "\nREFUSING to write without confirmation: not an interactive terminal.\n" +
        "Re-run with --yes if the target was chosen deliberately (e.g. a CI\n" +
        "environment and its scoped secret) rather than typed.",
    );
    return false;
  }
  const answer = prompt(`Write to ${target}? Type the host to confirm:`);
  if (answer?.trim() !== target.split("/")[0]) {
    console.error("Target not confirmed. Nothing was written.");
    return false;
  }
  return true;
}

type UnsortedRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  message_count: number;
};

type DuplicatePair = {
  a: string;
  b: string;
  conversation_ids: string[];
};

async function main() {
  const unsorted = (await db.execute(sql`
    SELECT c.id,
           c.user1_id,
           c.user2_id,
           (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id)::int
             AS message_count
      FROM conversations c
     WHERE c.user1_id <> LEAST(c.user1_id, c.user2_id)
     ORDER BY c.created_at
  `)) as unknown as { rows: UnsortedRow[] };

  const duplicates = (await db.execute(sql`
    SELECT LEAST(user1_id, user2_id) AS a,
           GREATEST(user1_id, user2_id) AS b,
           array_agg(id::text) AS conversation_ids
      FROM conversations
     GROUP BY 1, 2
    HAVING count(*) > 1
  `)) as unknown as { rows: DuplicatePair[] };

  console.log(`Unsorted pairs: ${unsorted.rows.length}`);
  for (const row of unsorted.rows) {
    console.log(
      `  ${row.id}  ${row.user1_id} / ${row.user2_id}  (${row.message_count} messages)`,
    );
  }

  console.log(
    `Duplicate pairs (both orderings present): ${duplicates.rows.length}`,
  );
  for (const row of duplicates.rows) {
    console.log(`  ${row.a} / ${row.b} → ${row.conversation_ids.join(", ")}`);
  }

  if (duplicates.rows.length > 0) {
    console.error(
      "\nDuplicate pairs exist. Normalizing would violate the unique constraint,\n" +
        "and merging two threads is a judgement call about message history, not\n" +
        "something this script should decide. Merge or delete them by hand first.",
    );
    process.exit(1);
  }

  if (unsorted.rows.length === 0) {
    console.log("\nNothing to normalize.");
    return;
  }

  if (!apply) {
    console.log("\nAudit only. Re-run with --apply to normalize these rows.");
    return;
  }

  if (!confirmTarget()) {
    process.exit(1);
  }

  const result = await db.execute(sql`
    UPDATE conversations
       SET user1_id = user2_id,
           user2_id = user1_id,
           user1_last_read_at = user2_last_read_at,
           user2_last_read_at = user1_last_read_at,
           user1_archived = user2_archived,
           user2_archived = user1_archived
     WHERE user1_id <> LEAST(user1_id, user2_id)
  `);

  console.log(
    `\nNormalized ${result.rowCount ?? unsorted.rows.length} row(s) on ${target}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

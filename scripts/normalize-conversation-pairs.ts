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
 *   bun scripts/normalize-conversation-pairs.ts --apply   # rewrite rows
 *
 * (`bun`, not `tsx`: `src/db/db.ts` uses top-level await, which tsx's CJS
 * transform rejects.)
 *
 * Refuses to run against production. Swapping the pair swaps the per-user
 * columns with it (`userNLastReadAt`, `userNArchived`) so nobody's read state or
 * archive flag moves to the other person.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F20 / P-E11-7
 */
import { sql } from "drizzle-orm";

import { db } from "../src/db/db";

const apply = process.argv.includes("--apply");

if (process.env.NODE_ENV === "production") {
  console.error("REFUSING to run against production (NODE_ENV=production).");
  process.exit(1);
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
    `\nNormalized ${result.rowCount ?? unsorted.rows.length} row(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

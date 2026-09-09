import { and, eq, or, type SQL, type SQLWrapper } from "drizzle-orm";

import { conversations } from "@/db/schemas/messages.schema";

/**
 * Match the conversation belonging to a user pair, in either stored order.
 *
 * The previous predicate compared `user1_id`/`user2_id` against
 * `LEAST(a, b)`/`GREATEST(a, b)`, which depends on two things that are not
 * guaranteed to agree:
 *
 * 1. **Collation.** Rows are written with `[a, b].sort()` — JavaScript's
 *    UTF-16 code-unit order — while `LEAST`/`GREATEST` on `text` use the
 *    database collation. They agree under `C`/`C.UTF-8` and disagree under a
 *    locale collation on mixed-case ids.
 * 2. **The sorted-pair invariant itself.** Rows written outside
 *    `findOrCreateConversation` (the seed, historically) store the pair
 *    unsorted, and no ordered comparison can find those at all.
 *
 * The symmetric predicate is correct under any collation and for any stored
 * order, and still uses the `conversations_user1_idx` / `_user2_idx` indexes.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F19 / F20 /
 *       P-E11-6
 */
export function conversationBetween(
  userA: SQLWrapper | string,
  userB: SQLWrapper | string,
): SQL | undefined {
  return or(
    and(eq(conversations.user1Id, userA), eq(conversations.user2Id, userB)),
    and(eq(conversations.user1Id, userB), eq(conversations.user2Id, userA)),
  );
}

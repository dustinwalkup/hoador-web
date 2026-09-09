import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { conversationBetween } from "../conversation-pair";

/**
 * The predicate these tests pin is the one every `conversationId` join on
 * rental and booking detail now uses. Asserting the generated SQL is the point:
 * the bug it replaces was invisible in TypeScript and only showed up as a
 * silently-null `conversationId`.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F19 / F20 /
 *       P-E11-6
 */
const dialect = new PgDialect();
const render = (a: string, b: string) =>
  dialect.sqlToQuery(conversationBetween(a, b)!);

describe("conversationBetween", () => {
  it("matches the pair in either stored order", () => {
    const { sql, params } = render("user-a", "user-b");

    expect(sql).toBe(
      '(("conversations"."user1_id" = $1 and "conversations"."user2_id" = $2) or ' +
        '("conversations"."user1_id" = $3 and "conversations"."user2_id" = $4))',
    );
    expect(params).toEqual(["user-a", "user-b", "user-b", "user-a"]);
  });

  it("does not depend on database collation", () => {
    // `LEAST`/`GREATEST` compare with the database collation while rows are
    // written with JavaScript's `[a, b].sort()` (UTF-16 code units). The two
    // agree under C/C.UTF-8 and disagree under a locale collation on mixed-case
    // ids — so the ordered predicate could match nothing for a conversation
    // that plainly exists.
    const { sql } = render("user-a", "user-b");

    expect(sql).not.toContain("LEAST");
    expect(sql).not.toContain("GREATEST");
  });

  it("is symmetric in its arguments", () => {
    const forward = render("user-a", "user-b");
    const reverse = render("user-b", "user-a");

    // Same shape either way round; only which id binds first differs, so both
    // call sites of a pair produce the same match.
    expect(forward.sql).toBe(reverse.sql);
    expect(forward.params).toEqual(["user-a", "user-b", "user-b", "user-a"]);
    expect(reverse.params).toEqual(["user-b", "user-a", "user-a", "user-b"]);
  });
});

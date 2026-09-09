import {
  and,
  eq,
  desc,
  or,
  sql,
  isNull,
  gt,
  lt,
  ne,
  exists,
  ilike,
  type SQL,
} from "drizzle-orm";
import { QueryBuilder, type PgColumn } from "drizzle-orm/pg-core";
import { tryCatch } from "@walkup/walkup-utils";

import { conversations, messages } from "@/db/schemas/messages.schema";
import { user } from "@/db/schemas/user.schema";
import { BaseDAL } from "./base";
import { ConversationSummary, ConversationDetails } from "./types";
import { conversationBetween } from "./conversation-pair";
import {
  CannotMessageSelfError,
  ConversationArchivedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import { sanitizeMessageContent } from "@/lib/utils/sanitize";

// Types
type ConversationDb = typeof conversations.$inferSelect;
type MessageDb = typeof messages.$inferSelect;

/** The user columns every messaging payload needs to name and picture someone. */
const participantColumns = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  image: true,
  profileImageUrl: true,
} as const;

type Participant = {
  firstName: string | null;
  lastName: string | null;
  name?: string | null;
  image?: string | null;
  profileImageUrl?: string | null;
};

/**
 * Compose a human name from the columns we actually have.
 *
 * `first_name`/`last_name` are nullable ("Nullable for Better Auth
 * compatibility"), so template-literal composition rendered social sign-ups
 * that never completed a profile as the string `"null null"` — on the wire, to
 * every messaging client. Falls back to better-auth's non-null `name`, then to
 * a neutral label, matching what the message routes already do for
 * notification sender names.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F5 / P-E11-2
 */
function displayName(participant: Participant): string {
  return (
    [participant.firstName, participant.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    participant.name?.trim() ||
    "Neighbor"
  );
}

/** Initials for the avatar fallback; blank when we know neither name part. */
function initialsOf(participant: Participant): string {
  return `${participant.firstName?.[0] || ""}${participant.lastName?.[0] || ""}`;
}

/**
 * `before` is either a message id or an ISO timestamp, and the two are told
 * apart by shape rather than by trying `new Date()` first and falling back.
 *
 * V8's legacy date parser accepts a great deal that is not a date —
 * `new Date("message-1")` is 1 January 2001 — so a fallback silently reads an
 * id as a timestamp and returns the wrong page. Message ids are `uuid`s, which
 * that parser rejects, so today's ids happen to survive it; that is luck, not a
 * contract.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * A keyset position in a thread. `id` breaks `createdAt` ties for a message-id
 * cursor and is null for a timestamp cursor, which has no tie to break.
 */
type ThreadCursor = { createdAt: Date; id: string | null };

/** Everything strictly older than the cursor, in `(createdAt, id)` order. */
function olderThan(cursor: ThreadCursor) {
  if (cursor.id === null) {
    return lt(messages.createdAt, cursor.createdAt);
  }

  return or(
    lt(messages.createdAt, cursor.createdAt),
    and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id)),
  );
}

/** Default thread page size, and the ceiling a caller can ask for. */
export const DEFAULT_THREAD_LIMIT = 50;
export const MAX_THREAD_LIMIT = 100;

/**
 * Clamp a caller-supplied page size into [1, MAX_THREAD_LIMIT].
 *
 * `undefined` and `NaN` both mean "the caller said nothing usable" and take the
 * default — a `parseInt` of garbage must not become an unbounded read.
 */
function normalizeThreadLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_THREAD_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_THREAD_LIMIT);
}

/**
 * The profile picture the rest of the app renders (listing detail, provider
 * profile, rental and booking detail all read `profileImageUrl`, with
 * better-auth's OAuth `image` behind it). Both columns have always existed;
 * these payloads hardcoded `null` and left the inbox initials-only. (F6)
 */
function avatarOf(participant: Participant): string | null {
  return participant.profileImageUrl ?? participant.image ?? null;
}

/** Default conversation page size, and the ceiling a caller can ask for. */
export const DEFAULT_CONVERSATION_LIMIT = 20;
export const MAX_CONVERSATION_LIMIT = 100;

/**
 * Clamp a caller-supplied page size into [1, MAX_CONVERSATION_LIMIT].
 *
 * The route reaches this with `parseInt(searchParams.get("limit") || "20")`,
 * which is unbounded and NaN-prone — `?limit=abc` arrived at Drizzle as `NaN`
 * and `?limit=100000` read the whole inbox. `undefined` and `NaN` both mean
 * "the caller said nothing usable" and take the default. (F8)
 */
function normalizeConversationLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_CONVERSATION_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_CONVERSATION_LIMIT);
}

/** Same treatment for `offset`: garbage and negatives mean "from the top". */
function normalizeConversationOffset(offset?: number): number {
  if (offset === undefined || Number.isNaN(offset)) {
    return 0;
  }

  return Math.max(Math.trunc(offset), 0);
}

/**
 * Wrap a search term for a `contains` ILIKE, escaping the wildcards a person
 * can type into a search box.
 *
 * `%` and `_` are LIKE metacharacters, so an unescaped term makes `%` match
 * every conversation and `_` match any character — a search box that quietly
 * means something else than what was typed. Backslash is Postgres' default LIKE
 * escape character, so no `ESCAPE` clause is needed.
 */
function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * Match a conversation on the **other** participant's name or on the content of
 * any message in the thread, case-insensitively.
 *
 * Server-side because the client alternative is a filter over the pages React
 * Query happens to hold: defensible on web's single page of 20, actively
 * misleading on an infinite mobile list, where "no results" would really mean
 * "nothing matched the part you already scrolled past". (F2 / D-E11-3)
 *
 * Both name predicates are correlated `EXISTS` subqueries rather than a join so
 * the relational read above keeps its shape (and its `limit`/`offset`
 * semantics) — a join to `user` would multiply rows before the page is taken.
 * The name is matched the way it is *displayed*: `first last` composed with
 * `concat_ws` (which skips the nullable halves, and lets "jane sm" match
 * "Jane Smith"), with better-auth's `name` behind it, mirroring `displayName`.
 *
 * Returns `undefined` for a blank term so it composes into `and()` as "no
 * filter" — an empty search box is not a search for the empty string.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F2 / P-E11-3
 */
export function conversationSearchPredicate(
  userId: string,
  search?: string,
): SQL | undefined {
  const trimmed = search?.trim();

  if (!trimmed) {
    return undefined;
  }

  const term = likeContains(trimmed);
  const qb = new QueryBuilder();

  const nameMatches = (otherUserId: PgColumn) =>
    exists(
      qb
        .select({ one: sql`1` })
        .from(user)
        .where(
          and(
            eq(user.id, otherUserId),
            or(
              ilike(
                sql`concat_ws(' ', ${user.firstName}, ${user.lastName})`,
                term,
              ),
              ilike(user.name, term),
            ),
          ),
        ),
    );

  return or(
    and(eq(conversations.user1Id, userId), nameMatches(conversations.user2Id)),
    and(eq(conversations.user2Id, userId), nameMatches(conversations.user1Id)),
    exists(
      qb
        .select({ one: sql`1` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversations.id),
            ilike(messages.content, term),
          ),
        ),
    ),
  );
}

export class MessagesDAL extends BaseDAL {
  async findOrCreateConversation(
    user1Id: string,
    user2Id: string,
  ): Promise<ConversationDb> {
    const { data, error } = await tryCatch(
      (async () => {
        if (user1Id === user2Id) {
          throw new CannotMessageSelfError();
        }

        const [smallerId, largerId] = [user1Id, user2Id].sort();

        // Look the pair up symmetrically, but keep writing it sorted: rows
        // written outside this method (the seed) stored the pair unsorted, and
        // an ordered lookup misses those and inserts a *second* conversation
        // for the same two people — the unique constraint is on the ordered
        // pair, so both rows coexist and each holds half the history. (F20)
        let conversation = await this.db.query.conversations.findFirst({
          where: conversationBetween(user1Id, user2Id),
        });

        if (!conversation) {
          [conversation] = await this.db
            .insert(conversations)
            .values({
              user1Id: smallerId,
              user2Id: largerId,
            })
            .returning();
        }

        return conversation;
      })(),
    );

    if (error) {
      this.handleError(error, "findOrCreateConversation");
    }

    return data;
  }

  /**
   * Load a conversation and assert the caller is one of its two participants.
   *
   * Every mutating method used to look the row up, then silently no-op for a
   * non-participant: `updateData` stayed `{}` and Drizzle threw on an empty
   * `.set()`, which `BaseDAL.handleError` wrapped into a 500 — the wrong status
   * for both "no such conversation" and "not yours", and a Sentry incident for
   * each one. (F15)
   *
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § P-E11-1
   */
  private async requireParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDb> {
    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      throw new NotFoundError("Conversation", conversationId);
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      throw new ForbiddenError(
        "You are not a participant in this conversation",
      );
    }

    return conversation;
  }

  /**
   * Resolve a `before` cursor to the `(createdAt, id)` pair the keyset compares
   * against. Accepts a message id — what a client naturally has, being the last
   * row it rendered — or an ISO timestamp.
   *
   * A message id that is not in this conversation is rejected rather than
   * ignored: silently falling back to "newest" would hand the caller a page it
   * has already seen and, on a "load older" button, look like the thread had
   * looped.
   */
  private async resolveThreadCursor(
    conversationId: string,
    before?: string,
  ): Promise<ThreadCursor | null> {
    if (!before) {
      return null;
    }

    if (ISO_DATE_PATTERN.test(before)) {
      const timestamp = new Date(before);

      if (Number.isNaN(timestamp.getTime())) {
        throw new ValidationError(
          "`before` is not a valid timestamp",
          "before",
        );
      }

      // A timestamp cursor has no id to break ties with, and there is no
      // sentinel to stand in for one: `messages.id` is a `uuid` column, so any
      // out-of-range placeholder is a syntax error in Postgres rather than a
      // large value. `createdAt <` alone is what a timestamp cursor means.
      return { createdAt: timestamp, id: null };
    }

    if (!UUID_PATTERN.test(before)) {
      throw new ValidationError(
        "`before` must be a message id or an ISO timestamp",
        "before",
      );
    }

    const cursorMessage = await this.db.query.messages.findFirst({
      where: and(
        eq(messages.id, before),
        eq(messages.conversationId, conversationId),
      ),
      columns: { id: true, createdAt: true },
    });

    if (!cursorMessage) {
      throw new ValidationError(
        "`before` must be a message id from this conversation",
        "before",
      );
    }

    return cursorMessage;
  }

  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
    rentalId?: string,
  ): Promise<MessageDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        // Sanitize and validate message content
        const sanitizedContent = sanitizeMessageContent(content);

        const conversation = await this.findOrCreateConversation(
          senderId,
          recipientId,
        );

        return await this.db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId,
            content: sanitizedContent,
            rentalId,
          })
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessage");
    }

    return data;
  }

  async sendMessageToUser(
    senderId: string,
    recipientId: string,
    content: string,
    listingId?: string,
    serviceListingId?: string,
  ): Promise<{ conversationId: string; messageId: string }> {
    const { data, error } = await tryCatch(
      (async () => {
        // Sanitize and validate message content
        const sanitizedContent = sanitizeMessageContent(content);

        const conversation = await this.findOrCreateConversation(
          senderId,
          recipientId,
        );

        const [message] = await this.db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId,
            content: sanitizedContent,
            listingId,
            serviceListingId,
          })
          .returning();

        // Update conversation's lastMessageAt
        await this.db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversation.id));

        return {
          conversationId: conversation.id,
          messageId: message.id,
        };
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessageToUser");
    }

    return data;
  }

  /**
   * Unpaginated convenience wrapper, kept for backward compatibility. It now
   * returns at most `MAX_CONVERSATION_LIMIT` rows rather than 1000, because the
   * clamp that stops `?limit=100000` from reading a whole inbox lives in the
   * paginated method and applies to every caller. Nothing in the codebase calls
   * this today.
   */
  async getUserConversations(
    userId: string,
    archived?: boolean,
  ): Promise<ConversationSummary[]> {
    return this.getUserConversationsPaginated(
      userId,
      archived,
      0,
      MAX_CONVERSATION_LIMIT,
    );
  }

  /**
   * One page of the caller's inbox, newest activity first.
   *
   * `search` is a case-insensitive `contains` over the other participant's name
   * and over every message in the thread, composed with the `archived` filter
   * rather than replacing it, and leaving the ordering alone. `limit` and
   * `offset` are clamped here rather than at the route, so no caller can turn a
   * garbage query param into an unbounded read. (F2 / F8)
   *
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § P-E11-3
   */
  async getUserConversationsPaginated(
    userId: string,
    archived?: boolean,
    offset: number = 0,
    limit: number = DEFAULT_CONVERSATION_LIMIT,
    search?: string,
  ): Promise<ConversationSummary[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const pageSize = normalizeConversationLimit(limit);
        const pageOffset = normalizeConversationOffset(offset);

        const userConversations = await this.db.query.conversations.findMany({
          where: and(
            or(
              eq(conversations.user1Id, userId),
              eq(conversations.user2Id, userId),
            ),
            conversationSearchPredicate(userId, search),
            // Filter by archived status if specified
            archived !== undefined
              ? or(
                  and(
                    eq(conversations.user1Id, userId),
                    eq(conversations.user1Archived, archived),
                  ),
                  and(
                    eq(conversations.user2Id, userId),
                    eq(conversations.user2Archived, archived),
                  ),
                )
              : undefined,
          ),
          with: {
            user1: { columns: participantColumns },
            user2: { columns: participantColumns },
            messages: {
              orderBy: [desc(messages.createdAt)],
              limit: 1,
              with: {
                sender: { columns: participantColumns },
              },
            },
          },
          orderBy: [desc(conversations.lastMessageAt)],
          offset: pageOffset,
          limit: pageSize,
        });

        return userConversations.map((conversation) => {
          const otherUser =
            conversation.user1.id === userId
              ? conversation.user2
              : conversation.user1;

          const lastMessage = conversation.messages[0];
          const isUnread =
            conversation.user1.id === userId
              ? conversation.user1LastReadAt === null ||
                (lastMessage &&
                  conversation.user1LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== userId) // Don't mark as unread if we sent the last message
              : conversation.user2LastReadAt === null ||
                (lastMessage &&
                  conversation.user2LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== userId); // Don't mark as unread if we sent the last message

          return {
            id: conversation.id,
            otherUser: {
              id: otherUser.id,
              name: displayName(otherUser),
              firstName: otherUser.firstName,
              lastName: otherUser.lastName,
              avatar: avatarOf(otherUser),
              initials: initialsOf(otherUser),
            },
            lastMessage: lastMessage
              ? {
                  content: lastMessage.content,
                  time: lastMessage.createdAt,
                  senderId: lastMessage.senderId,
                }
              : null,
            unread: isUnread,
            lastMessageAt: conversation.lastMessageAt,
            archived:
              conversation.user1.id === userId
                ? conversation.user1Archived
                : conversation.user2Archived,
          };
        });
      })(),
    );

    if (error) {
      this.handleError(error, "getUserConversations");
    }

    return data;
  }

  /**
   * Read one thread: the newest `limit` messages, oldest-first, plus whether
   * older ones exist.
   *
   * This used to load **every** message ever exchanged, each with three joins,
   * with no limit — and Req 16.1.5 puts a 15–30s poll on top of that while the
   * screen is focused, so a long-running neighbor relationship re-downloaded
   * its entire history every tick. (F3)
   *
   * `before` is a keyset cursor, not an offset: either a message id (a uuid) or
   * an ISO timestamp. Offsets shift under you when a message arrives mid-scroll, which
   * on a live thread means duplicated or skipped rows; a keyset on
   * `(createdAt, id)` is stable whatever arrives while the user is reading.
   *
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F3 / P-E11-4
   */
  async getConversationDetails(
    conversationId: string,
    userId: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<ConversationDetails> {
    const { data, error } = await tryCatch(
      (async () => {
        const limit = normalizeThreadLimit(options.limit);

        const conversation = await this.db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
          with: {
            user1: { columns: participantColumns },
            user2: { columns: participantColumns },
          },
        });

        if (!conversation) {
          throw new NotFoundError("Conversation", conversationId);
        }

        if (
          conversation.user1Id !== userId &&
          conversation.user2Id !== userId
        ) {
          throw new ForbiddenError(
            "You are not a participant in this conversation",
          );
        }

        const cursor = await this.resolveThreadCursor(
          conversationId,
          options.before,
        );

        // One extra row is the cheapest possible `hasMore`: if it comes back,
        // there is at least one older message than the window we return.
        const window = await this.db.query.messages.findMany({
          where: and(
            eq(messages.conversationId, conversationId),
            cursor ? olderThan(cursor) : undefined,
          ),
          orderBy: [desc(messages.createdAt), desc(messages.id)],
          limit: limit + 1,
          with: {
            sender: { columns: participantColumns },
            listing: {
              columns: {
                id: true,
                name: true,
              },
            },
            serviceListing: {
              columns: {
                id: true,
                title: true,
              },
            },
          },
        });

        const hasMore = window.length > limit;
        // Fetched newest-first for the cursor; returned oldest-first, which is
        // the order every existing client already renders.
        const threadMessages = (hasMore ? window.slice(0, limit) : window)
          .slice()
          .reverse();

        // Read state is a property of the conversation, not of the window: when
        // the caller is paging backwards the newest message is not in `window`
        // at all, and computing `unread` from the window's last row would say
        // "read" for a thread with something new waiting at the bottom.
        const otherUser =
          conversation.user1.id === userId
            ? conversation.user2
            : conversation.user1;

        const lastMessage = cursor
          ? await this.db.query.messages.findFirst({
              where: eq(messages.conversationId, conversationId),
              orderBy: [desc(messages.createdAt), desc(messages.id)],
              columns: { id: true, createdAt: true, senderId: true },
            })
          : threadMessages[threadMessages.length - 1];

        // `lastMessage` is undefined for a thread with no messages, so this
        // expression used to evaluate to `undefined` and `JSON.stringify`
        // dropped the key entirely (F4). Coerced, because a payload that
        // sometimes omits a documented boolean is a trap for every client.
        const isUnread = Boolean(
          conversation.user1.id === userId
            ? conversation.user1LastReadAt === null ||
                (lastMessage &&
                  conversation.user1LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== userId)
            : conversation.user2LastReadAt === null ||
                (lastMessage &&
                  conversation.user2LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== userId),
        );

        return {
          id: conversation.id,
          otherUser: {
            id: otherUser.id,
            name: displayName(otherUser),
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            avatar: avatarOf(otherUser),
            initials: initialsOf(otherUser),
          },
          messages: threadMessages.map((message) => ({
            id: message.id,
            content: message.content,
            time: message.createdAt,
            sender: (message.senderId === userId ? "me" : "them") as
              | "me"
              | "them",
            senderName: displayName(message.sender),
            senderAvatar: avatarOf(message.sender),
            listingId: message.listing?.id ?? null,
            listingName: message.listing?.name ?? null,
            serviceListingId: message.serviceListing?.id ?? null,
            serviceListingName: message.serviceListing?.title ?? null,
          })),
          unread: isUnread,
          archived:
            conversation.user1.id === userId
              ? conversation.user1Archived
              : conversation.user2Archived,
          hasMore,
        };
      })(),
    );

    if (error) {
      this.handleError(error, "getConversationDetails");
    }

    return data;
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const conversation = await this.requireParticipant(
          conversationId,
          userId,
        );

        const updateData: { user1LastReadAt?: Date; user2LastReadAt?: Date } =
          {};
        if (conversation.user1Id === userId) {
          updateData.user1LastReadAt = new Date();
        } else if (conversation.user2Id === userId) {
          updateData.user2LastReadAt = new Date();
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "markConversationAsRead");
    }

    return data;
  }

  async markConversationAsUnread(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const conversation = await this.requireParticipant(
          conversationId,
          userId,
        );

        // Use sql function to explicitly set NULL values
        const updateData: {
          user1LastReadAt?: ReturnType<typeof sql>;
          user2LastReadAt?: ReturnType<typeof sql>;
        } = {};

        if (conversation.user1Id === userId) {
          updateData.user1LastReadAt = sql`NULL`;
        } else if (conversation.user2Id === userId) {
          updateData.user2LastReadAt = sql`NULL`;
        }

        // Unreachable: requireParticipant proved the caller is user1 or
        // user2. Kept as a belt-and-braces guard against an empty `.set()`.
        if (Object.keys(updateData).length === 0) {
          throw new ForbiddenError(
            "You are not a participant in this conversation",
          );
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "markConversationAsUnread");
    }

    return data;
  }

  async sendMessageInConversation(
    conversationId: string,
    senderId: string,
    content: string,
    rentalId?: string,
  ): Promise<{ message: MessageDb; recipientId: string }> {
    const { data, error } = await tryCatch(
      (async () => {
        // Sanitize and validate message content
        const sanitizedContent = sanitizeMessageContent(content);

        // Verify user is part of conversation (404 vs 403, not one 500)
        const conversation = await this.requireParticipant(
          conversationId,
          senderId,
        );

        // Check if sender has archived this conversation
        const senderHasArchived =
          (conversation.user1Id === senderId && conversation.user1Archived) ||
          (conversation.user2Id === senderId && conversation.user2Archived);

        if (senderHasArchived) {
          throw new ConversationArchivedError();
        }

        const [message] = await this.db
          .insert(messages)
          .values({
            conversationId,
            senderId,
            content: sanitizedContent,
            rentalId,
          })
          .returning();

        // Update conversation's lastMessageAt
        await this.db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));

        const recipientId =
          conversation.user1Id === senderId
            ? conversation.user2Id
            : conversation.user1Id;

        return { message, recipientId };
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessageInConversation");
    }

    return data;
  }

  async archiveConversation(
    conversationId: string,
    userId: string,
    archived: boolean = true,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const conversation = await this.requireParticipant(
          conversationId,
          userId,
        );

        const updateData: { user1Archived?: boolean; user2Archived?: boolean } =
          {};
        if (conversation.user1Id === userId) {
          updateData.user1Archived = archived;
        } else if (conversation.user2Id === userId) {
          updateData.user2Archived = archived;
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "archiveConversation");
    }

    return data;
  }

  async unarchiveConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDb[]> {
    return this.archiveConversation(conversationId, userId, false);
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const { error } = await tryCatch(
      (async () => {
        // Verify user is part of conversation (404 vs 403, not one 500)
        await this.requireParticipant(conversationId, userId);

        // Delete the conversation (messages will be cascaded)
        await this.db
          .delete(conversations)
          .where(eq(conversations.id, conversationId));
      })(),
    );

    if (error) {
      this.handleError(error, "deleteConversation");
    }
  }

  /**
   * Get total unread message count for the current user
   * Counts all unread messages across all non-archived conversations
   */
  async getUnreadMessageCount(userId: string): Promise<number> {
    const { data, error } = await tryCatch(
      (async () => {
        // Use SQL to efficiently count unread messages
        // We need to count messages where:
        // 1. The conversation belongs to the current user
        // 2. The conversation is not archived for the current user
        // 3. The message was sent by the other user (not current user)
        // 4. The message was created after the user's last read timestamp (or all if never read)

        const result = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .innerJoin(
            conversations,
            eq(messages.conversationId, conversations.id),
          )
          .where(
            and(
              // Conversation involves the current user
              or(
                eq(conversations.user1Id, userId),
                eq(conversations.user2Id, userId),
              ),
              // Exclude archived conversations
              or(
                and(
                  eq(conversations.user1Id, userId),
                  eq(conversations.user1Archived, false),
                ),
                and(
                  eq(conversations.user2Id, userId),
                  eq(conversations.user2Archived, false),
                ),
              ),
              // Message was sent by the other user (not current user)
              ne(messages.senderId, userId),
              // Message is unread: either never read, or created after last read
              or(
                // User1 case: never read or message after last read
                and(
                  eq(conversations.user1Id, userId),
                  or(
                    isNull(conversations.user1LastReadAt),
                    gt(messages.createdAt, conversations.user1LastReadAt),
                  ),
                ),
                // User2 case: never read or message after last read
                and(
                  eq(conversations.user2Id, userId),
                  or(
                    isNull(conversations.user2LastReadAt),
                    gt(messages.createdAt, conversations.user2LastReadAt),
                  ),
                ),
              ),
            ),
          );

        return Number(result[0]?.count || 0);
      })(),
    );

    if (error) {
      this.handleError(error, "getUnreadMessageCount");
    }

    return data;
  }
}

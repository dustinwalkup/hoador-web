import {
  desc,
  eq,
  ne,
  and,
  count,
  lt,
  lte,
  gte,
  isNotNull,
  sql,
} from "drizzle-orm";
import {
  notifications,
  notificationCategoryPreferences,
  pushSubscriptions,
  pushNotificationAudit,
} from "@/db/schemas/notifications.schema";
import { user } from "@/db/schemas/user.schema";
import { notificationCategoryEnum } from "@/db/schemas/_enums";
import { DALError, ValidationError } from "./errors";
import { BaseDAL } from "./base";
import type { PaginatedResult } from "./types";

/** Category preference row for a user. */
export interface NotificationCategoryPreferenceRow {
  id: string;
  userId: string;
  category: (typeof notificationCategoryEnum.enumValues)[number];
  email: boolean;
  push: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateNotificationData {
  userId: string;
  type: (typeof notifications.type.enumValues)[number];
  title: string;
  message: string;
  data?: Record<string, string | number | boolean | string[] | null>;
}

export interface NotificationWithUser {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, string | number | boolean | string[] | null>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export class NotificationDAL extends BaseDAL {
  /**
   * Create a new notification
   */
  async create(data: CreateNotificationData) {
    try {
      // Validate user exists
      const existingUser = await this.db.query.user.findFirst({
        where: eq(user.id, data.userId),
      });

      if (!existingUser) {
        throw new ValidationError("User not found", "userId");
      }

      const [notification] = await this.db
        .insert(notifications)
        .values({
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data || {},
          isRead: false,
        })
        .returning();

      return notification;
    } catch (error) {
      this.handleError(error, "create notification");
    }
  }

  /**
   * Get paginated notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      isRead?: boolean;
      type?: string;
    } = {},
  ): Promise<PaginatedResult<NotificationWithUser>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      // Build where clause
      const whereConditions = [eq(notifications.userId, userId)];

      // Handle read/unread filtering
      if (options.unreadOnly) {
        whereConditions.push(eq(notifications.isRead, false));
      } else if (options.isRead !== undefined) {
        whereConditions.push(eq(notifications.isRead, options.isRead));
      }

      // Handle type filtering
      if (options.type) {
        whereConditions.push(sql`${notifications.type} = ${options.type}`);
      }

      // Get total count
      const [{ value: total }] = await this.db
        .select({ value: count() })
        .from(notifications)
        .where(and(...whereConditions));

      // Get notifications with user data
      const results = await this.db
        .select({
          id: notifications.id,
          userId: notifications.userId,
          type: notifications.type,
          title: notifications.title,
          message: notifications.message,
          data: notifications.data,
          isRead: notifications.isRead,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          },
        })
        .from(notifications)
        .innerJoin(user, eq(notifications.userId, user.id))
        .where(and(...whereConditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return this.createPaginatedResult(
        results as NotificationWithUser[],
        total,
        page,
        limit,
      );
    } catch (error) {
      this.handleError(error, "get user notifications");
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const [{ value }] = await this.db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false),
          ),
        );

      return value;
    } catch (error) {
      this.handleError(error, "get unread count");
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    try {
      const [notification] = await this.db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId),
          ),
        )
        .returning();

      if (!notification) {
        throw new DALError(
          "Notification not found or access denied",
          "NOT_FOUND",
          404,
        );
      }

      return notification;
    } catch (error) {
      this.handleError(error, "mark notification as read");
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      await this.db
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false),
          ),
        );

      return { success: true };
    } catch (error) {
      this.handleError(error, "mark all notifications as read");
    }
  }

  /**
   * Toggle notification read status
   */
  async toggleReadStatus(
    notificationId: string,
    userId: string,
    isRead: boolean,
  ) {
    try {
      const [notification] = await this.db
        .update(notifications)
        .set({
          isRead: !isRead,
          readAt: !isRead ? new Date() : null,
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId),
          ),
        )
        .returning();

      if (!notification) {
        throw new DALError(
          "Notification not found or access denied",
          "NOT_FOUND",
          404,
        );
      }

      return notification;
    } catch (error) {
      this.handleError(error, "toggle notification read status");
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    try {
      const [notification] = await this.db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId),
          ),
        )
        .returning();

      if (!notification) {
        throw new DALError(
          "Notification not found or access denied",
          "NOT_FOUND",
          404,
        );
      }

      return notification;
    } catch (error) {
      this.handleError(error, "delete notification");
    }
  }

  /**
   * Get a single notification by ID
   */
  async getById(notificationId: string, userId: string) {
    try {
      const notification = await this.db.query.notifications.findFirst({
        where: and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      });

      if (!notification) {
        throw new DALError(
          "Notification not found or access denied",
          "NOT_FOUND",
          404,
        );
      }

      return notification;
    } catch (error) {
      this.handleError(error, "get notification by id");
    }
  }

  /**
   * Delete notifications older than specified days
   * Used by cron job for cleanup
   */
  async deleteOldNotifications(daysOld: number): Promise<number> {
    try {
      if (daysOld < 1) {
        throw new ValidationError("daysOld must be at least 1", "daysOld");
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deletedNotifications = await this.db
        .delete(notifications)
        .where(lt(notifications.createdAt, cutoffDate))
        .returning();

      return deletedNotifications.length;
    } catch (error) {
      this.handleError(error, "delete old notifications");
    }
  }

  /**
   * Returns true if a rental_reminder was already sent for this rental and type within the last N ms.
   * Used by reminder cron to avoid duplicate reminders.
   */
  async hasRentalReminderBeenSent(
    userId: string,
    rentalId: string,
    reminderType: "pickup" | "return",
    withinLastMs: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinLastMs);
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "rental_reminder"),
          gte(notifications.createdAt, since),
          sql`${notifications.data}->>'rentalId' = ${rentalId}`,
          sql`${notifications.data}->>'reminderType' = ${reminderType}`,
        ),
      )
      .limit(1);
    return !!row;
  }
}

/** Category for notification preferences (bookings, payments, messages, disputes, reminders). */
export type NotificationCategoryPreferenceCategory =
  (typeof notificationCategoryEnum.enumValues)[number];

/** Per-category email/push overrides for upsertMany. */
export type CategoryPreferencesInput = Partial<
  Record<
    NotificationCategoryPreferenceCategory,
    { email?: boolean; push?: boolean }
  >
>;

/**
 * Data access for notification category preferences (per-category email/push toggles).
 * Requirements: 1.6, 1.9
 */
export class NotificationCategoryPreferencesDAL extends BaseDAL {
  /**
   * Get all category preferences for a user. Returns empty array if none exist (caller uses defaults).
   */
  async getByUserId(
    userId: string,
  ): Promise<NotificationCategoryPreferenceRow[]> {
    try {
      return await this.withReadRetry(
        () =>
          this.db.query.notificationCategoryPreferences.findMany({
            where: eq(notificationCategoryPreferences.userId, userId),
          }),
        "get category preferences by user id",
      );
    } catch (error) {
      this.handleError(error, "get category preferences by user id");
    }
  }

  /**
   * Insert or update a single category preference for a user.
   */
  async upsert(
    userId: string,
    category: NotificationCategoryPreferenceCategory,
    email: boolean,
    push: boolean,
  ): Promise<NotificationCategoryPreferenceRow> {
    try {
      const [row] = await this.db
        .insert(notificationCategoryPreferences)
        .values({
          userId,
          category,
          email,
          push,
        })
        .onConflictDoUpdate({
          target: [
            notificationCategoryPreferences.userId,
            notificationCategoryPreferences.category,
          ],
          set: {
            email,
            push,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new DALError("Upsert failed", "UNKNOWN", 500);
      return row;
    } catch (error) {
      this.handleError(error, "upsert category preference");
    }
  }

  /**
   * Bulk upsert category preferences for a user.
   * @param categories - Map of category to { email, push }
   */
  async upsertMany(
    userId: string,
    categories: CategoryPreferencesInput,
  ): Promise<NotificationCategoryPreferenceRow[]> {
    try {
      const results: NotificationCategoryPreferenceRow[] = [];
      const categoryValues = notificationCategoryEnum.enumValues;
      for (const category of categoryValues) {
        const prefs = categories[category];
        if (prefs === undefined) continue;
        const email = prefs.email ?? true;
        const push = prefs.push ?? true;
        const row = await this.upsert(userId, category, email, push);
        results.push(row);
      }
      return results;
    } catch (error) {
      this.handleError(error, "upsert many category preferences");
    }
  }
}

// ---- Push subscriptions and audit (Phase 5 dependency) ----

/** DB row for a push subscription (id needed for deactivate/audit). */
export interface PushSubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  /** Null for native rows — an Expo token has no VAPID keypair (F1). */
  p256dh: string | null;
  /** Null for native rows. */
  auth: string | null;
  platform: string;
  token: string | null;
  userAgent: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Subscription shape accepted by web-push sendNotification. */
export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

/** Native (Expo) subscription — the mobile app's `{platform, token}` payload. */
export interface NativePushSubscription {
  platform: "ios" | "android";
  token: string;
}

/**
 * Narrows a subscription row to the web shape.
 *
 * `p256dh`/`auth` are nullable at the DB level since native push landed, so the
 * send path must prove a row is well-formed rather than assume it. A `web` row
 * missing either key is corrupt, not native — callers skip it rather than
 * sending a malformed request to the push service.
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (F1, D-E2-1).
 */
export function isWebSubscriptionRow(
  row: PushSubscriptionRow,
): row is PushSubscriptionRow & { p256dh: string; auth: string } {
  return row.platform === "web" && Boolean(row.p256dh) && Boolean(row.auth);
}

/** Narrows a subscription row to the native shape. */
export function isNativeSubscriptionRow(
  row: PushSubscriptionRow,
): row is PushSubscriptionRow & { token: string } {
  return (
    (row.platform === "ios" || row.platform === "android") && Boolean(row.token)
  );
}

/**
 * Data access for push subscriptions. Requirements: 3.1, 3.5, 10.1, 10.2
 */
export class PushSubscriptionDAL extends BaseDAL {
  /**
   * Create a push subscription for a user. Validates subscription shape (endpoint, keys.p256dh, keys.auth).
   */
  async create(
    userId: string,
    subscription: WebPushSubscription,
    userAgent?: string | null,
  ): Promise<PushSubscriptionRow> {
    try {
      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        throw new ValidationError(
          "Subscription must have endpoint and keys.p256dh and keys.auth",
          "subscription",
        );
      }
      // Idempotent by endpoint: a device re-subscribing (app launch, permission
      // grant, or subscription refresh) must refresh its existing row rather than
      // stack a new one — otherwise sendPush fans out to every duplicate and the
      // user receives N identical pushes. Also self-heals any duplicates that
      // already accumulated for this endpoint by deactivating the extras.
      const existing = await this.getByEndpoint(subscription.endpoint);
      if (existing) {
        const [updated] = await this.db
          .update(pushSubscriptions)
          .set({
            userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent: userAgent ?? null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.id, existing.id))
          .returning();
        if (!updated) throw new DALError("Update failed", "UNKNOWN", 500);
        // Deactivate any other rows sharing this endpoint (collapse dupes).
        await this.db
          .update(pushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushSubscriptions.endpoint, subscription.endpoint),
              ne(pushSubscriptions.id, existing.id),
            ),
          );
        return updated;
      }

      const [row] = await this.db
        .insert(pushSubscriptions)
        .values({
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent ?? null,
        })
        .returning();
      if (!row) throw new DALError("Insert failed", "UNKNOWN", 500);
      return row;
    } catch (error) {
      this.handleError(error, "create push subscription");
    }
  }

  /**
   * Get active push subscriptions for a user (for sending push).
   */
  async getActiveByUserId(userId: string): Promise<PushSubscriptionRow[]> {
    try {
      return await this.withReadRetry(
        () =>
          this.db.query.pushSubscriptions.findMany({
            where: and(
              eq(pushSubscriptions.userId, userId),
              eq(pushSubscriptions.isActive, true),
            ),
          }),
        "get active push subscriptions by user id",
      );
    } catch (error) {
      this.handleError(error, "get active push subscriptions by user id");
    }
  }

  /**
   * Mark a subscription as inactive (e.g. after 410/404 from push service).
   */
  async deactivate(id: string): Promise<void> {
    try {
      await this.db
        .update(pushSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, id));
    } catch (error) {
      this.handleError(error, "deactivate push subscription");
    }
  }

  /**
   * Get subscription by endpoint (for deduplication / canonical ID).
   */
  async getByEndpoint(endpoint: string): Promise<PushSubscriptionRow | null> {
    try {
      const row = await this.db.query.pushSubscriptions.findFirst({
        where: eq(pushSubscriptions.endpoint, endpoint),
      });
      return row ?? null;
    } catch (error) {
      this.handleError(error, "get push subscription by endpoint");
    }
  }

  /**
   * Create or refresh a native (Expo) push subscription.
   *
   * Idempotent by token, mirroring `create`'s endpoint idempotency: a device
   * re-registering (app launch, permission grant, token rotation) refreshes its
   * row rather than stacking a new one — otherwise the send path fans out to
   * every duplicate and the user gets N identical pushes.
   *
   * `endpoint` is set to the token: it is `NOT NULL` and carries no meaning for
   * native rows, but keeping it populated means the shared indexes and the
   * `getByEndpoint` dedup path stay well-defined for both shapes.
   * Requirements: 2.2.1. Spec: epic-02-backend-services.md § 2.1 (F2).
   */
  async createNative(
    userId: string,
    subscription: NativePushSubscription,
    userAgent?: string | null,
  ): Promise<PushSubscriptionRow> {
    try {
      if (!subscription?.token || !subscription?.platform) {
        throw new ValidationError(
          "Native subscription must have platform and token",
          "subscription",
        );
      }

      const existing = await this.getByToken(subscription.token);
      if (existing) {
        const [updated] = await this.db
          .update(pushSubscriptions)
          .set({
            userId,
            platform: subscription.platform,
            endpoint: subscription.token,
            userAgent: userAgent ?? null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.id, existing.id))
          .returning();
        if (!updated) throw new DALError("Update failed", "UNKNOWN", 500);
        // Collapse any duplicates that predate the partial unique index.
        await this.db
          .update(pushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushSubscriptions.token, subscription.token),
              ne(pushSubscriptions.id, existing.id),
            ),
          );
        return updated;
      }

      const [row] = await this.db
        .insert(pushSubscriptions)
        .values({
          userId,
          platform: subscription.platform,
          token: subscription.token,
          endpoint: subscription.token,
          userAgent: userAgent ?? null,
        })
        .returning();
      if (!row) throw new DALError("Insert failed", "UNKNOWN", 500);
      return row;
    } catch (error) {
      this.handleError(error, "create native push subscription");
    }
  }

  /**
   * Get subscription by Expo push token (dedup + sign-out deactivation).
   */
  async getByToken(token: string): Promise<PushSubscriptionRow | null> {
    try {
      const row = await this.db.query.pushSubscriptions.findFirst({
        where: eq(pushSubscriptions.token, token),
      });
      return row ?? null;
    } catch (error) {
      this.handleError(error, "get push subscription by token");
    }
  }

  /**
   * Deactivate every subscription sharing an Expo token.
   *
   * Token-scoped rather than id-scoped because the receipt cron and the send
   * path only know the token that Expo reported as dead — and a token can span
   * more than one row if duplicates predate the partial unique index.
   * Requirements: 2.2.4.
   */
  async deactivateByToken(token: string): Promise<void> {
    try {
      await this.db
        .update(pushSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pushSubscriptions.token, token));
    } catch (error) {
      this.handleError(error, "deactivate push subscription by token");
    }
  }

  /**
   * Deactivate all of a user's subscriptions (account deletion, task 2.6.2).
   * Requirements: 2.5.1.
   */
  async deactivateAllForUser(userId: string): Promise<void> {
    try {
      await this.db
        .update(pushSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.isActive, true),
          ),
        );
    } catch (error) {
      this.handleError(error, "deactivate all push subscriptions for user");
    }
  }

  /**
   * Expo push tickets awaiting a receipt check.
   *
   * `olderThanMs` exists because Expo does not produce receipts instantly —
   * querying too eagerly burns a request and returns nothing. `youngerThanMs`
   * bounds the other end: receipts are retained ~24h, so older tickets are
   * unresolvable and must not be retried forever.
   * Requirements: 2.2.4.
   */
  async getPendingReceipts(opts: {
    olderThanMs: number;
    youngerThanMs: number;
    limit: number;
  }): Promise<
    {
      id: string;
      userId: string;
      subscriptionId: string | null;
      expoTicketId: string;
    }[]
  > {
    try {
      const now = Date.now();
      const rows = await this.db
        .select({
          id: pushNotificationAudit.id,
          userId: pushNotificationAudit.userId,
          subscriptionId: pushNotificationAudit.subscriptionId,
          expoTicketId: pushNotificationAudit.expoTicketId,
        })
        .from(pushNotificationAudit)
        .where(
          and(
            eq(pushNotificationAudit.receiptStatus, "pending"),
            isNotNull(pushNotificationAudit.expoTicketId),
            lte(pushNotificationAudit.sentAt, new Date(now - opts.olderThanMs)),
            gte(
              pushNotificationAudit.sentAt,
              new Date(now - opts.youngerThanMs),
            ),
          ),
        )
        .orderBy(pushNotificationAudit.sentAt)
        .limit(opts.limit);

      return rows.filter(
        (r): r is (typeof rows)[number] & { expoTicketId: string } =>
          r.expoTicketId !== null,
      );
    } catch (error) {
      this.handleError(error, "get pending push receipts");
    }
  }

  /**
   * Resolve a checked receipt. Requirements: 2.2.4.
   */
  async resolveReceipt(
    auditId: string,
    receiptStatus: "ok" | "error",
    errorMessage?: string | null,
  ): Promise<void> {
    try {
      await this.db
        .update(pushNotificationAudit)
        .set({
          receiptStatus,
          // A receipt is the authoritative delivery signal — a send recorded as
          // successful at ticket time is downgraded here if the receipt errored.
          success: receiptStatus === "ok",
          ...(errorMessage !== undefined ? { errorMessage } : {}),
        })
        .where(eq(pushNotificationAudit.id, auditId));
    } catch (error) {
      this.handleError(error, "resolve push receipt");
    }
  }

  /**
   * Give up on tickets whose receipts have aged out of Expo's ~24h retention.
   * Without this they stay `pending` forever and the cron re-queries them on
   * every run. Requirements: 2.2.4.
   */
  async expireStaleReceipts(olderThanMs: number): Promise<number> {
    try {
      const rows = await this.db
        .update(pushNotificationAudit)
        .set({
          receiptStatus: "error",
          errorMessage: "Receipt expired before it could be checked",
        })
        .where(
          and(
            eq(pushNotificationAudit.receiptStatus, "pending"),
            lte(
              pushNotificationAudit.sentAt,
              new Date(Date.now() - olderThanMs),
            ),
          ),
        )
        .returning({ id: pushNotificationAudit.id });
      return rows.length;
    } catch (error) {
      this.handleError(error, "expire stale push receipts");
    }
  }

  /**
   * Create an audit log entry for a push send (success or failure).
   * Requirements: 11.1, 11.2, 11.5
   */
  async createAuditLog(
    userId: string,
    subscriptionId: string | null,
    eventType: string,
    success: boolean,
    errorMessage?: string | null,
    receipt?: {
      expoTicketId: string | null;
      receiptStatus: "pending" | "ok" | "error";
    },
  ): Promise<void> {
    try {
      await this.db.insert(pushNotificationAudit).values({
        userId,
        subscriptionId,
        eventType,
        success,
        errorMessage: errorMessage ?? null,
        // Omitted for web sends, leaving both columns null — web-push has no
        // receipt concept (D-E2-2).
        expoTicketId: receipt?.expoTicketId ?? null,
        receiptStatus: receipt?.receiptStatus ?? null,
      });
    } catch (error) {
      // Best-effort: by the time this runs the push has already been
      // delivered (or already failed). Audit-log failures must not bubble
      // up — they'd corrupt the push-service retry logic and generate
      // Sentry noise for an observability-only side effect.
      console.warn(
        "[DAL] createAuditLog failed (non-fatal):",
        (error as Error)?.message,
        { userId, subscriptionId, eventType, success },
      );
    }
  }
}

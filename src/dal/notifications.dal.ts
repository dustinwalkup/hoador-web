import { desc, eq, and, count, lt, gte, sql } from "drizzle-orm";
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
      const rows = await this.db.query.notificationCategoryPreferences.findMany(
        {
          where: eq(notificationCategoryPreferences.userId, userId),
        },
      );
      return rows;
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
  p256dh: string;
  auth: string;
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
      const rows = await this.db.query.pushSubscriptions.findMany({
        where: and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.isActive, true),
        ),
      });
      return rows;
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
   * Create an audit log entry for a push send (success or failure).
   * Requirements: 11.1, 11.2, 11.5
   */
  async createAuditLog(
    userId: string,
    subscriptionId: string | null,
    eventType: string,
    success: boolean,
    errorMessage?: string | null,
  ): Promise<void> {
    try {
      await this.db.insert(pushNotificationAudit).values({
        userId,
        subscriptionId,
        eventType,
        success,
        errorMessage: errorMessage ?? null,
      });
    } catch (error) {
      this.handleError(error, "create push audit log");
    }
  }
}

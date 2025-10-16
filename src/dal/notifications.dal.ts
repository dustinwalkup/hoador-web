import { desc, eq, and, count, lt, sql } from "drizzle-orm";
import { notifications } from "@/db/schemas/notifications.schema";
import { user } from "@/db/schemas/user.schema";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { DALError, ValidationError, UnauthorizedError } from "./errors";
import { BaseDAL } from "./base";
import type { PaginatedResult } from "./types";

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
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      isRead?: boolean;
      type?: string;
    } = {},
  ): Promise<PaginatedResult<NotificationWithUser>> {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async getUnreadCount(): Promise<number> {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async markAsRead(notificationId: string) {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async markAllAsRead() {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async toggleReadStatus(notificationId: string, isRead: boolean) {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async deleteNotification(notificationId: string) {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
  async getById(notificationId: string) {
    try {
      // Verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
        .returning({ id: notifications.id });

      return deletedNotifications.length;
    } catch (error) {
      this.handleError(error, "delete old notifications");
    }
  }
}

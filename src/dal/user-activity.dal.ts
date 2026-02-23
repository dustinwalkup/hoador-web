import { eq, and, or, desc, sql, lt, lte, count, type SQL } from "drizzle-orm";

import { schema } from "@/db/schemas";
import { BaseDAL } from "./base";
import type { PaginationOptions, PaginatedResult } from "./types";
import type { UserStatus, UserType } from "./types";

const { user, userActivityLog } = schema;

/** Activity type from the user_activity_type enum. */
export type UserActivityType =
  typeof userActivityLog.$inferSelect.activityType extends infer T ? T : never;

export interface LogActivityParams {
  userId: string;
  activityType: UserActivityType;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface GetActivityForUserOptions extends PaginationOptions {
  activityType?: UserActivityType;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  activityType: UserActivityType;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface GetInactiveUsersOptions extends PaginationOptions {
  status?: UserStatus;
  userType?: UserType;
}

export interface InactiveUserRow {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  lastActiveAt: Date | null;
  createdAt: Date;
}

export interface ActivityStats {
  activeLast24h: number;
  activeLast7d: number;
  activeLast30d: number;
  activeLast90d: number;
  inactive30d: number;
  inactive60d: number;
  inactive90d: number;
}

export interface RecentActivityEntry {
  id: string;
  userId: string;
  activityType: UserActivityType;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

/**
 * Data access layer for user activity log and last-active tracking.
 * Used for admin activity overview and inactivity filtering.
 */
export class UserActivityDAL extends BaseDAL {
  /**
   * Log an activity event and update the user's lastActiveAt timestamp.
   */
  async logActivity(params: LogActivityParams): Promise<void> {
    const { userId, activityType, metadata, ipAddress, userAgent } = params;
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx.insert(userActivityLog).values({
        userId,
        activityType,
        metadata: metadata ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });
      await tx
        .update(user)
        .set({ lastActiveAt: now })
        .where(eq(user.id, userId));
    });
  }

  /**
   * Get paginated activity for a single user.
   */
  async getActivityForUser(
    userId: string,
    options: GetActivityForUserOptions,
  ): Promise<PaginatedResult<ActivityLogEntry>> {
    const { page, limit, activityType, dateFrom, dateTo } = options;
    this.validatePagination(page, limit);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(userActivityLog.userId, userId)];
    if (activityType) {
      conditions.push(eq(userActivityLog.activityType, activityType));
    }
    if (dateFrom) {
      conditions.push(sql`${userActivityLog.createdAt} >= ${dateFrom}`);
    }
    if (dateTo) {
      conditions.push(sql`${userActivityLog.createdAt} <= ${dateTo}`);
    }
    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(userActivityLog)
        .where(whereClause),
      this.db
        .select()
        .from(userActivityLog)
        .where(whereClause)
        .orderBy(desc(userActivityLog.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const data: ActivityLogEntry[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      activityType: row.activityType,
      metadata: row.metadata as Record<string, unknown> | null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    }));

    return this.createPaginatedResult(data, total, page, limit);
  }

  /**
   * Get users who have been inactive for at least the given number of days
   * (lastActiveAt is null or before the threshold).
   */
  async getInactiveUsers(
    inactiveSinceDays: number,
    options: GetInactiveUsersOptions,
  ): Promise<PaginatedResult<InactiveUserRow>> {
    const { page, limit, status, userType } = options;
    this.validatePagination(page, limit);
    const offset = (page - 1) * limit;

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - inactiveSinceDays);

    const conditions: SQL[] = [
      or(
        lt(user.lastActiveAt, threshold),
        sql`${user.lastActiveAt} IS NULL`,
      ) as SQL,
      // Account must be at least that old to count as "inactive X+ days"
      lte(user.createdAt, threshold),
    ];
    if (status) {
      conditions.push(eq(user.status, status));
    }
    if (userType) {
      conditions.push(eq(user.userType, userType));
    }
    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(user).where(whereClause),
      this.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          userType: user.userType,
          lastActiveAt: user.lastActiveAt,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(whereClause)
        .orderBy(desc(user.lastActiveAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const data: InactiveUserRow[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      userType: row.userType,
      lastActiveAt: row.lastActiveAt,
      createdAt: row.createdAt,
    }));

    return this.createPaginatedResult(data, total, page, limit);
  }

  /**
   * Get dashboard-level activity stats: active user counts by bucket and inactive counts.
   */
  async getActivityStats(): Promise<ActivityStats> {
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const t24h = new Date(now.getTime() - 1 * day);
    const t7d = new Date(now.getTime() - 7 * day);
    const t30d = new Date(now.getTime() - 30 * day);
    const t90d = new Date(now.getTime() - 90 * day);
    const inactive30Threshold = new Date(now.getTime() - 30 * day);
    const inactive60Threshold = new Date(now.getTime() - 60 * day);
    const inactive90Threshold = new Date(now.getTime() - 90 * day);

    const [
      active24h,
      active7d,
      active30d,
      active90d,
      inactive30,
      inactive60,
      inactive90,
    ] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(user)
        .where(sql`${user.lastActiveAt} >= ${t24h}`),
      this.db
        .select({ count: count() })
        .from(user)
        .where(sql`${user.lastActiveAt} >= ${t7d}`),
      this.db
        .select({ count: count() })
        .from(user)
        .where(sql`${user.lastActiveAt} >= ${t30d}`),
      this.db
        .select({ count: count() })
        .from(user)
        .where(sql`${user.lastActiveAt} >= ${t90d}`),
      this.db
        .select({ count: count() })
        .from(user)
        .where(
          and(
            or(
              lt(user.lastActiveAt, inactive30Threshold),
              sql`${user.lastActiveAt} IS NULL`,
            ) as SQL,
            lte(user.createdAt, inactive30Threshold),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(user)
        .where(
          and(
            or(
              lt(user.lastActiveAt, inactive60Threshold),
              sql`${user.lastActiveAt} IS NULL`,
            ) as SQL,
            lte(user.createdAt, inactive60Threshold),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(user)
        .where(
          and(
            or(
              lt(user.lastActiveAt, inactive90Threshold),
              sql`${user.lastActiveAt} IS NULL`,
            ) as SQL,
            lte(user.createdAt, inactive90Threshold),
          ),
        ),
    ]);

    return {
      activeLast24h: Number(active24h[0]?.count ?? 0),
      activeLast7d: Number(active7d[0]?.count ?? 0),
      activeLast30d: Number(active30d[0]?.count ?? 0),
      activeLast90d: Number(active90d[0]?.count ?? 0),
      inactive30d: Number(inactive30[0]?.count ?? 0),
      inactive60d: Number(inactive60[0]?.count ?? 0),
      inactive90d: Number(inactive90[0]?.count ?? 0),
    };
  }

  /**
   * Get the most recent activity entries across all users (for dashboard feed).
   */
  async getRecentActivity(limit: number): Promise<RecentActivityEntry[]> {
    const rows = await this.db
      .select({
        id: userActivityLog.id,
        userId: userActivityLog.userId,
        activityType: userActivityLog.activityType,
        metadata: userActivityLog.metadata,
        createdAt: userActivityLog.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(userActivityLog)
      .innerJoin(user, eq(userActivityLog.userId, user.id))
      .orderBy(desc(userActivityLog.createdAt))
      .limit(Math.min(limit, 100));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      activityType: row.activityType,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      userName: row.userName,
      userEmail: row.userEmail,
    }));
  }
}

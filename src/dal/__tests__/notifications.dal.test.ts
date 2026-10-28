import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationsDAL } from "../index";
import { ValidationError, DALError } from "../errors";
import {
  mockNotificationDbRecord,
  mockNotificationWithUser,
  mockNotificationsWithUser,
} from "@/test/fixtures/notifications";
import { db } from "@/db/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql as rawSql, type SQL } from "drizzle-orm";
import { pushSubscriptionDAL } from "../index";
import { ownerVisibleToViewerHome } from "../visibility-sql";
import { communityVisibility } from "@/db/schemas/communities.schema";

/** Placeholder numbers and whitespace differ once a fragment is embedded. */
const normalizeSql = (text: string) =>
  text.replace(/\$\d+/g, "$?").replace(/\s+/g, " ");

// Mock dependencies
vi.mock("@/db/db", () => {
  const mockSelect = vi.fn();
  return {
    db: {
      query: {
        notifications: {
          findFirst: vi.fn(),
        },
        user: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: mockSelect,
      execute: vi.fn(),
    },
  };
});

describe("NotificationDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset db.select mock to ensure clean state between tests
    vi.mocked(db.select).mockReset();
  });

  describe("create", () => {
    it("should create notification successfully", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
      };

      vi.mocked(db.query.user.findFirst).mockResolvedValue(mockUser as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockNotificationDbRecord]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      const notificationData = {
        userId: "user-123",
        type: "rental_request_created" as const,
        title: "New Rental Request",
        message: "You have a new rental request",
        data: { rentalId: "rental-123" },
      };

      // Act
      const result = await notificationsDAL.create(notificationData);

      // Assert
      expect(result).toEqual(mockNotificationDbRecord);
      expect(db.query.user.findFirst).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it("should throw ValidationError when user not found", async () => {
      // Arrange
      vi.mocked(db.query.user.findFirst).mockResolvedValue(undefined);

      const notificationData = {
        userId: "user-invalid",
        type: "rental_request_created" as const,
        title: "New Rental Request",
        message: "You have a new rental request",
      };

      // Act & Assert
      await expect(notificationsDAL.create(notificationData)).rejects.toThrow(
        ValidationError,
      );
      expect(db.query.user.findFirst).toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should handle different notification types", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
      };

      vi.mocked(db.query.user.findFirst).mockResolvedValue(mockUser as any);

      const notificationTypes = [
        "rental_request_created",
        "rental_approved",
        "rental_denied",
        "payment_succeeded",
        "review_received",
        "system",
      ] as const;

      for (const type of notificationTypes) {
        vi.clearAllMocks();
        vi.mocked(db.query.user.findFirst).mockResolvedValue(mockUser as any);

        const mockReturning = vi
          .fn()
          .mockResolvedValue([{ ...mockNotificationDbRecord, type }]);
        const mockValues = vi.fn().mockReturnValue({
          returning: mockReturning,
        });

        vi.mocked(db.insert).mockReturnValue({
          values: mockValues,
        } as any);

        const notificationData = {
          userId: "user-123",
          type,
          title: "Test Title",
          message: "Test Message",
        };

        // Act
        const result = await notificationsDAL.create(notificationData);

        // Assert
        expect(result.type).toBe(type);
      }
    });

    it("should handle optional data field", async () => {
      // Arrange
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
      };

      vi.mocked(db.query.user.findFirst).mockResolvedValue(mockUser as any);

      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockNotificationDbRecord]);
      const mockValues = vi.fn().mockReturnValue({
        returning: mockReturning,
      });

      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as any);

      const notificationData = {
        userId: "user-123",
        type: "rental_request_created" as const,
        title: "New Rental Request",
        message: "You have a new rental request",
        // data field omitted
      };

      // Act
      await notificationsDAL.create(notificationData);

      // Assert
      const valuesCall = vi.mocked(db.insert).mock.results[0].value.values;
      const valuesArg = valuesCall.mock.calls[0][0];
      expect(valuesArg.data).toEqual({});
    });
  });

  describe("getUserNotifications", () => {
    it("should return paginated notifications for authenticated user", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 2 }];

      // Mock for count query (first select call)
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Mock for notifications query (second select call)
      const mockNotificationsSelect = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(mockNotificationsWithUser),
                }),
              }),
            }),
          }),
        }),
      };

      // Setup mock to return different chainable objects for each call
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockNotificationsSelect as any);

      // Act
      const result = await notificationsDAL.getUserNotifications(userId, {
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result.data).toEqual(mockNotificationsWithUser);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it("should filter by unreadOnly", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 1 }];

      // Mock for count query (first select call)
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Mock for notifications query (second select call)
      const mockSelectNotifications = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([mockNotificationWithUser]),
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockSelectNotifications as any);

      // Act
      await notificationsDAL.getUserNotifications(userId, { unreadOnly: true });

      // Assert
      expect(db.select).toHaveBeenCalled();
    });

    it("should handle empty result set", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 0 }];

      // Mock for count query (first select call)
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Mock for notifications query (second select call) - return empty array
      const mockSelectNotifications = {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]), // Empty array
                }),
              }),
            }),
          }),
        }),
      };

      // Clear any previous mocks and set up fresh ones
      vi.mocked(db.select).mockClear();
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockSelectNotifications as any);

      // Act
      const result = await notificationsDAL.getUserNotifications(userId);

      // Assert
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 50 }];

      // Mock for count query (first select call)
      const mockCountSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Mock for notifications query (second select call)
      const mockOffset = vi.fn().mockResolvedValue(mockNotificationsWithUser);
      const mockLimit = vi.fn().mockReturnValue({
        offset: mockOffset,
      });
      const mockOrderBy = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      const mockFrom = vi.fn().mockReturnValue({
        innerJoin: mockInnerJoin,
      });

      const mockSelectNotifications = {
        from: mockFrom,
      };

      // Clear any previous mocks and set up fresh ones
      vi.mocked(db.select).mockClear();
      vi.mocked(db.select)
        .mockReturnValueOnce(mockCountSelect as any)
        .mockReturnValueOnce(mockSelectNotifications as any);

      // Act
      const result = await notificationsDAL.getUserNotifications(userId, {
        page: 2,
        limit: 20,
      });

      // Assert
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(50);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockOffset).toHaveBeenCalledWith(20); // (page - 1) * limit
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      // Arrange
      const userId = "user-123";
      const notificationId = "notification-123";

      const mockReturning = vi
        .fn()
        .mockResolvedValue([mockNotificationDbRecord]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act
      const result = await notificationsDAL.markAsRead(notificationId, userId);

      // Assert
      expect(result).toEqual(mockNotificationDbRecord);
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw DALError when notification not found", async () => {
      // Arrange
      const userId = "user-123";
      const notificationId = "notification-not-found";

      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({
        returning: mockReturning,
      });
      const mockSet = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.update).mockReturnValue({
        set: mockSet,
      } as any);

      // Act & Assert
      await expect(
        notificationsDAL.markAsRead(notificationId, userId),
      ).rejects.toThrow(DALError);
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all unread notifications as read", async () => {
      // Arrange
      const userId = "user-123";

      const mockWhere = vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      } as any);

      // Act
      const result = await notificationsDAL.markAllAsRead(userId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(db.update).toHaveBeenCalled();
    });

    it("should return success when no notifications to mark", async () => {
      // Arrange
      const userId = "user-123";

      const mockWhere = vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      } as any);

      // Act
      const result = await notificationsDAL.markAllAsRead(userId);

      // Assert
      expect(result).toEqual({ success: true });
    });
  });

  describe("getUnreadCount", () => {
    it("should return correct unread count", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 5 }];
      const mockSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Clear any previous mocks and set up fresh one
      vi.mocked(db.select).mockClear();
      vi.mocked(db.select).mockReturnValueOnce(mockSelect as any);

      // Act
      const result = await notificationsDAL.getUnreadCount(userId);

      // Assert
      expect(result).toBe(5);
    });

    it("should return zero when no unread notifications", async () => {
      // Arrange
      const userId = "user-123";

      const mockCountResult = [{ value: 0 }];
      const mockSelect = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCountResult),
        }),
      };

      // Clear any previous mocks and set up fresh one
      vi.mocked(db.select).mockClear();
      vi.mocked(db.select).mockReturnValueOnce(mockSelect as any);

      // Act
      const result = await notificationsDAL.getUnreadCount(userId);

      // Assert
      expect(result).toBe(0);
    });
  });
});

// SETTINGS-004 (member-based rule, approved 2026-10-26): a new need reaches
// only members the poster can see. The recipient's own flag for the need's
// community (the poster's home) was already checked; the poster's flag for
// each recipient's home is the half that was missing.
describe("need fan-out recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bulkCreateForVisibleCommunity skips members whose home the poster hid", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rowCount: 0 } as never);

    await notificationsDAL.bulkCreateForVisibleCommunity({
      communityId: "comm-g",
      excludeUserId: "poster-a",
      posterId: "poster-a",
      type: "neighborhood_need_created",
      title: "New need",
      message: "m",
      data: {},
    });

    const dialect = new PgDialect();
    const { sql, params } = dialect.sqlToQuery(
      vi.mocked(db.execute).mock.calls[0][0] as SQL,
    );
    const expected = dialect.sqlToQuery(
      ownerVisibleToViewerHome("poster-a", rawSql`cv.user_id`),
    ).sql;
    expect(normalizeSql(sql)).toContain(normalizeSql(expected));
    expect(params).toContain("poster-a");
  });

  it("getPushTargetsInCommunity skips members whose home the poster hid", async () => {
    const where = vi.fn().mockResolvedValue([]);
    const leftJoin2 = vi.fn().mockReturnValue({ where });
    const leftJoin1 = vi.fn().mockReturnValue({ leftJoin: leftJoin2 });
    const innerJoin = vi.fn().mockReturnValue({ leftJoin: leftJoin1 });
    const from = vi.fn().mockReturnValue({ innerJoin });
    vi.mocked(db.select).mockReturnValue({ from } as never);

    await pushSubscriptionDAL.getPushTargetsInCommunity({
      communityId: "comm-g",
      excludeUserId: "poster-a",
      posterId: "poster-a",
      category: "neighborhood_needs",
    });

    const dialect = new PgDialect();
    const { sql, params } = dialect.sqlToQuery(where.mock.calls[0][0]);
    const expected = dialect.sqlToQuery(
      ownerVisibleToViewerHome("poster-a", communityVisibility.userId),
    ).sql;
    expect(normalizeSql(sql)).toContain(normalizeSql(expected));
    expect(params).toContain("poster-a");
  });
});

/**
 * UAT E2E-015: revoking a user's sessions must stop pushes to the devices it
 * signed out, while the device that asked (a password change) keeps its own.
 */
describe("deactivateAllForUser", () => {
  function captureUpdate() {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as never);
    return { set, where };
  }

  function renderWhere(where: ReturnType<typeof vi.fn>) {
    return new PgDialect().sqlToQuery(where.mock.calls[0][0] as SQL);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivates every active subscription of the user", async () => {
    const { set, where } = captureUpdate();

    await pushSubscriptionDAL.deactivateAllForUser("user-1");

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    const { sql, params } = renderWhere(where);
    expect(sql).toContain(`"push_subscriptions"."user_id" = $`);
    expect(sql).toContain(`"push_subscriptions"."is_active" = $`);
    expect(sql).not.toContain(`"push_subscriptions"."token"`);
    expect(params).toEqual(["user-1", true]);
  });

  it("spares the calling device's token, and still reaches web rows (null token)", async () => {
    const { where } = captureUpdate();

    await pushSubscriptionDAL.deactivateAllForUser("user-1", {
      exceptToken: "ExponentPushToken[device-1]",
    });

    const { sql, params } = renderWhere(where);
    // `token <> $x` alone is NULL for a web row, which would leave every web
    // subscription active: the IS NULL branch is what reaches them.
    expect(normalizeSql(sql)).toContain(
      normalizeSql(
        `("push_subscriptions"."token" is null or "push_subscriptions"."token" <> $1)`,
      ),
    );
    expect(params).toEqual(["user-1", true, "ExponentPushToken[device-1]"]);
  });
});

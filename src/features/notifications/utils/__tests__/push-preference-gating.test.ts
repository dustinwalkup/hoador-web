import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Preference gating applies identically to web and native push.
 *
 * The parity is structural rather than duplicated: `shouldSendPush` is checked
 * once, *upstream* of `sendPush`, and `sendPush` owns the fan-out to both
 * transports. So there is exactly one gate and neither platform can drift from
 * it — these tests pin that structure, since a future refactor that gated
 * inside either branch would silently break the guarantee.
 *
 * Requirements: 2.2.6
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.1
 */

const mockShouldSendPush = vi.fn();
const mockShouldSendEmail = vi.fn().mockResolvedValue(false);
vi.mock("../../lib/preference-service", () => ({
  shouldSendPush: (...a: unknown[]) => mockShouldSendPush(...a),
  shouldSendEmail: (...a: unknown[]) => mockShouldSendEmail(...a),
}));

const mockSendPush = vi.fn();
vi.mock("../../lib/push-service", () => ({
  sendPush: (...a: unknown[]) => mockSendPush(...a),
}));

vi.mock("@/dal", () => ({
  notificationsDAL: {
    create: vi.fn().mockResolvedValue({ id: "notif-1" }),
  },
  userDAL: { getUserPreferences: vi.fn() },
  notificationCategoryPreferencesDAL: { getByUserId: vi.fn() },
  pushSubscriptionDAL: { getActiveByUserId: vi.fn() },
}));

vi.mock("../send-email", () => ({ sendEmail: vi.fn() }));

import { sendNotification } from "../send-notification";

/** Let the fire-and-forget push dispatch settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

const notify = () =>
  sendNotification({
    userId: "user-1",
    type: "rental_approved",
    title: "Request approved",
    message: "Your rental request was approved",
  });

describe("push preference gating (Req 2.2.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldSendEmail.mockResolvedValue(false);
  });

  it("dispatches no push at all when preferences disallow it", async () => {
    mockShouldSendPush.mockResolvedValue(false);

    await notify();
    await flush();

    // `sendPush` is the sole entry to *both* transports, so not calling it is
    // what makes the gate cover web and native identically.
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("dispatches once through the shared fan-out when preferences allow it", async () => {
    mockShouldSendPush.mockResolvedValue(true);

    await notify();
    await flush();

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        data: expect.objectContaining({ type: "rental_approved" }),
      }),
    );
  });

  it("gates on the notification's category, not the platform", async () => {
    // The check takes (userId, category) and knows nothing about devices —
    // there is no platform-conditional path for a preference to diverge on.
    mockShouldSendPush.mockResolvedValue(true);

    await notify();
    await flush();

    expect(mockShouldSendPush).toHaveBeenCalledTimes(1);
    expect(mockShouldSendPush).toHaveBeenCalledWith("user-1", "bookings");
  });

  it("still creates the in-app notification when push is disallowed", async () => {
    // In-app notifications are the permanent record; push is only the ping
    // (Req 2.2.7).
    mockShouldSendPush.mockResolvedValue(false);

    const result = await notify();
    await flush();

    expect(result.success).toBe(true);
    expect(result.notificationId).toBe("notif-1");
    expect(mockSendPush).not.toHaveBeenCalled();
  });
});

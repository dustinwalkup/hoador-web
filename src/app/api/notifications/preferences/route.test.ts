import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuthResponse = vi.fn().mockResolvedValue(null);
const mockGetCurrentUserId = vi.fn().mockResolvedValue("user-1");

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: vi.fn((err: unknown) => {
    throw err;
  }),
  requireAuthResponse: (...args: unknown[]) => mockRequireAuthResponse(...args),
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

const mockGetCategoryPreferences = vi.fn();
vi.mock("@/features/notifications/lib/preference-service", () => ({
  getCategoryPreferences: (...args: unknown[]) =>
    mockGetCategoryPreferences(...args),
}));

vi.mock("@/dal", () => ({
  userDAL: {
    updateUserPreferences: vi.fn().mockResolvedValue(undefined),
  },
  notificationCategoryPreferencesDAL: {
    upsertMany: vi.fn().mockResolvedValue(undefined),
  },
  userActivityDAL: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

import { GET, PATCH } from "./route";

const mockRequest = new NextRequest(
  "http://localhost/api/notifications/preferences",
);

describe("GET /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthResponse.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );
    const res = await GET(mockRequest);
    expect(res.status).toBe(401);
    expect(mockGetCategoryPreferences).not.toHaveBeenCalled();
  });

  it("returns defaults when no prefs exist", async () => {
    mockGetCategoryPreferences.mockResolvedValue({
      master: { email: true, push: true },
      categories: {
        bookings: { email: true, push: true },
        payments: { email: true, push: true },
        messages: { email: true, push: true },
        disputes: { email: true, push: true },
        reminders: { email: true, push: true },
      },
    });
    const res = await GET(mockRequest);
    expect(res.status).toBe(200);
    expect(mockGetCategoryPreferences).toHaveBeenCalledWith("user-1");
    const json = await res.json();
    expect(json.master).toEqual({ email: true, push: true });
    expect(json.categories.bookings).toEqual({ email: true, push: true });
  });
});

describe("PATCH /api/notifications/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthResponse.mockResolvedValue(null);
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockGetCategoryPreferences.mockResolvedValue({
      master: { email: true, push: true },
      categories: {
        bookings: { email: false, push: true },
        payments: { email: true, push: true },
        messages: { email: true, push: true },
        disputes: { email: true, push: true },
        reminders: { email: true, push: true },
      },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthResponse.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );
    const req = new NextRequest(
      "http://localhost/api/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify({
          categories: { bookings: { email: false } },
        }),
      },
    );
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("updates and returns preferences on valid PATCH", async () => {
    mockGetCategoryPreferences.mockResolvedValue({
      master: { email: true, push: true },
      categories: {
        bookings: { email: false, push: true },
        payments: { email: true, push: true },
        messages: { email: true, push: true },
        disputes: { email: true, push: true },
        reminders: { email: true, push: false },
      },
    });
    const req = new NextRequest(
      "http://localhost/api/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify({
          categories: {
            bookings: { email: false, push: true },
            reminders: { push: false },
          },
        }),
      },
    );
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.categories.bookings).toEqual({ email: false, push: true });
    expect(json.categories.reminders).toEqual({ email: true, push: false });
    expect(mockGetCategoryPreferences).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 on invalid payload", async () => {
    const req = new NextRequest(
      "http://localhost/api/notifications/preferences",
      {
        method: "PATCH",
        body: JSON.stringify({ categories: "invalid" }),
      },
    );
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

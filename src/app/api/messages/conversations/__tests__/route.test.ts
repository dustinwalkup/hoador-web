import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { CannotMessageSelfError } from "@/dal/errors";

// Per CLAUDE.md: mock the SESSION module so the route's real auth path runs.
const mockGetCurrentUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserId: async () => (await mockGetCurrentUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetCurrentUser();
    return user ? { user, userId: user.id, isAdmin: false } : null;
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetUserConversationsPaginated = vi.fn();
const mockSendMessageToUser = vi.fn();
const mockGetUserById = vi.fn();
vi.mock("@/dal", () => ({
  messagesDAL: {
    getUserConversationsPaginated: (...a: any[]) =>
      mockGetUserConversationsPaginated(...a),
    sendMessageToUser: (...a: any[]) => mockSendMessageToUser(...a),
  },
  userDAL: { getUserById: (...a: any[]) => mockGetUserById(...a) },
}));

vi.mock("@/features/messages/notifications/message-received", () => ({
  sendMessageReceivedNotification: vi.fn().mockResolvedValue(undefined),
}));

const postRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/messages/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/messages/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockGetUserConversationsPaginated.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated and reads nothing", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/messages/conversations"),
    );

    expect(res.status).toBe(401);
    expect(mockGetUserConversationsPaginated).not.toHaveBeenCalled();
  });

  it("returns the caller's conversations", async () => {
    mockGetUserConversationsPaginated.mockResolvedValue([{ id: "c-1" }]);

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/api/messages/conversations"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: "c-1" }]);
  });

  // P-E11-3: search is server-side. A client filter over the pages React Query
  // happens to hold means "no results" really says "nothing matched the part
  // you already scrolled past" — wrong in a way the user cannot see.
  it("passes ?search= through to the DAL alongside the other filters", async () => {
    const { GET } = await import("../route");
    await GET(
      new NextRequest(
        "http://localhost/api/messages/conversations?archived=true&offset=40&limit=20&search=jane",
      ),
    );

    expect(mockGetUserConversationsPaginated).toHaveBeenCalledWith(
      "user-1",
      true,
      40,
      20,
      "jane",
    );
  });

  it("sends no search when the param is absent", async () => {
    const { GET } = await import("../route");
    await GET(new NextRequest("http://localhost/api/messages/conversations"));

    expect(mockGetUserConversationsPaginated).toHaveBeenCalledWith(
      "user-1",
      false,
      0,
      20,
      undefined,
    );
  });

  it("keeps a term with a space intact", async () => {
    const { GET } = await import("../route");
    await GET(
      new NextRequest(
        "http://localhost/api/messages/conversations?search=jane%20smith",
      ),
    );

    expect(mockGetUserConversationsPaginated).toHaveBeenCalledWith(
      "user-1",
      false,
      0,
      20,
      "jane smith",
    );
  });

  // The clamp lives in the DAL so every caller gets it, not just this route —
  // so the route hands the garbage on unchanged and the DAL refuses it. (F8)
  it("hands a garbage limit to the DAL, which clamps it", async () => {
    const { GET } = await import("../route");
    await GET(
      new NextRequest(
        "http://localhost/api/messages/conversations?limit=abc&offset=xyz",
      ),
    );

    const [, , offset, limit] = mockGetUserConversationsPaginated.mock.calls[0];
    expect(Number.isNaN(offset)).toBe(true);
    expect(Number.isNaN(limit)).toBe(true);
  });
});

describe("POST /api/messages/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockSendMessageToUser.mockResolvedValue({
      conversationId: "c-1",
      messageId: "m-1",
    });
    mockGetUserById.mockResolvedValue({
      id: "user-2",
      email: "them@example.com",
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("starts a conversation and returns its id", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      postRequest({
        recipientId: "user-2",
        listingName: "Pressure washer",
        message: "Is this available next weekend?",
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      conversationId: "c-1",
    });
  });

  // P-E11-5: Req 16.1.3 says 1:1 conversations are between two different
  // people. Until this, only the UI enforced it.
  it("refuses a conversation with yourself with a stable code (400)", async () => {
    mockSendMessageToUser.mockRejectedValue(new CannotMessageSelfError());

    const { POST } = await import("../route");
    const res = await POST(
      postRequest({
        recipientId: "user-1",
        listingName: "Pressure washer",
        message: "Talking to myself here",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "CANNOT_MESSAGE_SELF",
    });
  });
});

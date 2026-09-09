import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { ConversationArchivedError, ForbiddenError } from "@/dal/errors";

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

const mockSendMessageInConversation = vi.fn();
const mockGetUserById = vi.fn();
vi.mock("@/dal", () => ({
  messagesDAL: {
    sendMessageInConversation: (...a: any[]) =>
      mockSendMessageInConversation(...a),
  },
  userDAL: { getUserById: (...a: any[]) => mockGetUserById(...a) },
}));

vi.mock("@/features/messages/notifications/message-received", () => ({
  sendMessageReceivedNotification: vi.fn().mockResolvedValue(undefined),
}));

const req = (content = "Hello") =>
  new NextRequest("http://localhost/api/messages/conversations/c-1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
const params = () => ({ params: Promise.resolve({ conversationId: "c-1" }) });

describe("POST /api/messages/conversations/[conversationId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockSendMessageInConversation.mockResolvedValue({
      message: { id: "m-1", content: "Hello" },
      recipientId: "user-2",
    });
    mockGetUserById.mockResolvedValue({
      id: "user-2",
      email: "them@example.com",
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("returns 401 when not authenticated and sends nothing", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(req(), params());

    expect(res.status).toBe(401);
    expect(mockSendMessageInConversation).not.toHaveBeenCalled();
  });

  it("sends the message", async () => {
    const { POST } = await import("../route");
    const res = await POST(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
  });

  // P-E11-1: this was a 500 with a prose body, which also reached Sentry as an
  // unexpected server error every time someone typed into an archived thread.
  it("returns 409 with CONVERSATION_ARCHIVED for an archived thread", async () => {
    mockSendMessageInConversation.mockRejectedValue(
      new ConversationArchivedError(),
    );

    const { POST } = await import("../route");
    const res = await POST(req(), params());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      code: "CONVERSATION_ARCHIVED",
    });
  });

  it("returns 403 for a non-participant sender", async () => {
    mockSendMessageInConversation.mockRejectedValue(new ForbiddenError());

    const { POST } = await import("../route");
    const res = await POST(req(), params());

    expect(res.status).toBe(403);
  });
});

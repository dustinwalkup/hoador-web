import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { ForbiddenError, NotFoundError } from "@/dal/errors";

/**
 * The four per-user state routes: archive, unarchive, read, unread.
 *
 * Two things they got wrong before P-E11-1: a non-participant produced an empty
 * `.set()` and therefore a 500, and a success returned the entire conversation
 * row — both user ids and both read timestamps — to a caller that only needed
 * the acknowledgement.
 */

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

const mockArchiveConversation = vi.fn();
const mockUnarchiveConversation = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkUnread = vi.fn();
vi.mock("@/dal", () => ({
  messagesDAL: {
    archiveConversation: (...a: any[]) => mockArchiveConversation(...a),
    unarchiveConversation: (...a: any[]) => mockUnarchiveConversation(...a),
    markConversationAsRead: (...a: any[]) => mockMarkRead(...a),
    markConversationAsUnread: (...a: any[]) => mockMarkUnread(...a),
  },
}));

const conversationRow = {
  id: "c-1",
  user1Id: "user-1",
  user2Id: "user-2",
  user1LastReadAt: new Date("2026-01-01"),
  user2LastReadAt: new Date("2026-01-02"),
  user1Archived: true,
  user2Archived: false,
};

const req = () =>
  new NextRequest("http://localhost/api/messages/conversations/c-1/archive", {
    method: "POST",
  });
const params = () => ({ params: Promise.resolve({ conversationId: "c-1" }) });

const routes = [
  {
    name: "archive",
    load: () => import("../archive/route"),
    mock: mockArchiveConversation,
  },
  {
    name: "unarchive",
    load: () => import("../unarchive/route"),
    mock: mockUnarchiveConversation,
  },
  { name: "read", load: () => import("../read/route"), mock: mockMarkRead },
  {
    name: "unread",
    load: () => import("../unread/route"),
    mock: mockMarkUnread,
  },
];

describe.each(routes)(
  "POST /api/messages/conversations/[conversationId]/$name",
  ({ load, mock }) => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
      mock.mockResolvedValue([conversationRow]);
    });

    it("returns 401 when not authenticated and changes nothing", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { POST } = await load();
      const res = await POST(req(), params());

      expect(res.status).toBe(401);
      expect(mock).not.toHaveBeenCalled();
    });

    it("acknowledges without echoing the conversation row", async () => {
      const { POST } = await load();
      const res = await POST(req(), params());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
      expect(JSON.stringify(body)).not.toContain("user-2");
    });

    it("maps a non-participant to 403", async () => {
      mock.mockRejectedValue(new ForbiddenError());

      const { POST } = await load();
      const res = await POST(req(), params());

      expect(res.status).toBe(403);
    });

    it("maps a missing conversation to 404", async () => {
      mock.mockRejectedValue(new NotFoundError("Conversation", "c-1"));

      const { POST } = await load();
      const res = await POST(req(), params());

      expect(res.status).toBe(404);
    });
  },
);

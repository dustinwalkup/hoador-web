import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";

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

const mockGetConversationDetails = vi.fn();
const mockDeleteConversation = vi.fn();
vi.mock("@/dal", () => ({
  messagesDAL: {
    getConversationDetails: (...a: any[]) => mockGetConversationDetails(...a),
    deleteConversation: (...a: any[]) => mockDeleteConversation(...a),
  },
}));

const req = () =>
  new NextRequest("http://localhost/api/messages/conversations/c-1");
const params = () => ({ params: Promise.resolve({ conversationId: "c-1" }) });

describe("GET /api/messages/conversations/[conversationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockGetConversationDetails.mockResolvedValue({ id: "c-1", messages: [] });
  });

  it("returns 401 when not authenticated and reads nothing", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(401);
    expect(mockGetConversationDetails).not.toHaveBeenCalled();
  });

  it("returns the thread for a participant", async () => {
    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "c-1", messages: [] });
  });

  // Both of these were an unconditional 500 before P-E11-1 — the wrong status,
  // and a Sentry incident for an ordinary bad link.
  it("maps a missing conversation to 404", async () => {
    mockGetConversationDetails.mockRejectedValue(
      new NotFoundError("Conversation", "c-1"),
    );

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(404);
  });

  it("maps a non-participant to 403", async () => {
    mockGetConversationDetails.mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const res = await GET(req(), params());

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/messages/conversations/[conversationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockDeleteConversation.mockResolvedValue(undefined);
  });

  it("maps a non-participant to 403 rather than deleting", async () => {
    mockDeleteConversation.mockRejectedValue(new ForbiddenError());

    const { DELETE } = await import("../route");
    const res = await DELETE(req(), params());

    expect(res.status).toBe(403);
  });
});

// P-E11-4: the thread read is paginated. The route parses leniently and lets
// the DAL clamp — a garbage `limit` must never become an unbounded read.
describe("GET /api/messages/conversations/[conversationId] — pagination", () => {
  const url = (qs = "") =>
    new NextRequest(`http://localhost/api/messages/conversations/c-1${qs}`);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", userType: "user" });
    mockGetConversationDetails.mockResolvedValue({
      id: "c-1",
      messages: [],
      hasMore: false,
    });
  });

  const optionsArg = () => mockGetConversationDetails.mock.calls[0][2];

  it("passes no window when the caller asks for none", async () => {
    const { GET } = await import("../route");
    await GET(url(), params());

    expect(optionsArg()).toEqual({ limit: undefined, before: undefined });
  });

  it("forwards limit and before", async () => {
    const { GET } = await import("../route");
    await GET(url("?limit=20&before=message-9"), params());

    expect(optionsArg()).toEqual({ limit: 20, before: "message-9" });
  });

  it("forwards a garbage limit as NaN for the DAL to clamp", async () => {
    const { GET } = await import("../route");
    await GET(url("?limit=all-of-them"), params());

    expect(Number.isNaN(optionsArg().limit)).toBe(true);
  });

  it("treats an empty limit as absent rather than zero", async () => {
    const { GET } = await import("../route");
    await GET(url("?limit="), params());

    expect(optionsArg().limit).toBeUndefined();
  });

  it("returns hasMore alongside the thread", async () => {
    mockGetConversationDetails.mockResolvedValue({
      id: "c-1",
      messages: [],
      hasMore: true,
    });

    const { GET } = await import("../route");
    const res = await GET(url("?limit=2"), params());

    await expect(res.json()).resolves.toMatchObject({ hasMore: true });
  });

  it("maps a cursor from another conversation to 400", async () => {
    mockGetConversationDetails.mockRejectedValue(
      new ValidationError("bad cursor", "before"),
    );

    const { GET } = await import("../route");
    const res = await GET(url("?before=message-elsewhere"), params());

    expect(res.status).toBe(400);
  });
});

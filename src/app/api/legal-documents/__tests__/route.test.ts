import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-1)
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockListLegalDocumentsForUser = vi.fn();
vi.mock("@/features/users/services/legal-documents-service", () => ({
  listLegalDocumentsForUser: (...a: unknown[]) =>
    mockListLegalDocumentsForUser(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const REQ = new NextRequest("http://localhost/api/legal-documents");

import { GET } from "../route";

const TOS = {
  id: "tos",
  name: "Terms of Service",
  version: "1.1",
  publishedAt: new Date("2026-09-01T00:00:00Z"),
  url: "https://blob.example.com/legal/tos-1.1.pdf",
  accepted: {
    version: "1.0",
    acceptedAt: new Date("2026-08-01T12:00:00Z"),
    url: "https://blob.example.com/legal/tos-1.0.pdf",
  },
};

describe("GET /api/legal-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
      isAdmin: false,
    });
    mockListLegalDocumentsForUser.mockResolvedValue([TOS]);
  });

  it("returns the caller's documents with their acceptances", async () => {
    const res = await GET(REQ);

    expect(res.status).toBe(200);
    expect(mockListLegalDocumentsForUser).toHaveBeenCalledWith("user-1");
    expect(await res.json()).toEqual({
      documents: [
        {
          id: "tos",
          name: "Terms of Service",
          version: "1.1",
          publishedAt: "2026-09-01T00:00:00.000Z",
          url: "https://blob.example.com/legal/tos-1.1.pdf",
          accepted: {
            version: "1.0",
            acceptedAt: "2026-08-01T12:00:00.000Z",
            url: "https://blob.example.com/legal/tos-1.0.pdf",
          },
        },
      ],
    });
  });

  it("returns accepted: null for a document never accepted", async () => {
    mockListLegalDocumentsForUser.mockResolvedValue([
      { ...TOS, accepted: null },
    ]);

    const res = await GET(REQ);

    expect((await res.json()).documents[0].accepted).toBeNull();
  });

  // The R-P-E13-0 rule: leak checks run against the serialized body.
  it("never serializes acceptance IP addresses or user agents", async () => {
    mockListLegalDocumentsForUser.mockResolvedValue([
      {
        ...TOS,
        ipAddress: "203.0.113.7",
        userAgent: "LeakyAgent/1.0",
        accepted: {
          ...TOS.accepted,
          ipAddress: "203.0.113.7",
          userAgent: "LeakyAgent/1.0",
        },
      },
    ]);

    const res = await GET(REQ);
    const raw = await res.text();

    expect(raw).not.toContain("ipAddress");
    expect(raw).not.toContain("203.0.113.7");
    expect(raw).not.toContain("userAgent");
    expect(raw).not.toContain("LeakyAgent");
  });

  it("is never cached by a shared cache", async () => {
    const res = await GET(REQ);

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await GET(REQ);

    expect(res.status).toBe(401);
    expect(mockListLegalDocumentsForUser).not.toHaveBeenCalled();
  });

  it("returns 500 on an unexpected failure", async () => {
    mockListLegalDocumentsForUser.mockRejectedValue(new Error("db exploded"));

    const res = await GET(REQ);

    expect(res.status).toBe(500);
  });
});

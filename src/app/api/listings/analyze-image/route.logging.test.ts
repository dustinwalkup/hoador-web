import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetForTests } from "@/lib/api/ai-rate-limit";

const loggerInfo = vi.fn();
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: loggerInfo }),
  getRequestContext: () => undefined,
  generateRequestId: () => "test-request-id",
  runWithRequestContext: <T>(_ctx: unknown, fn: () => T) => fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

const MOCK_USER_ID = "user-123";
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(async () => MOCK_USER_ID),
  getCurrentUser: vi.fn(async () => ({ id: MOCK_USER_ID })),
  getAuthenticatedUser: vi.fn(async () => ({
    user: { id: MOCK_USER_ID },
    userId: MOCK_USER_ID,
    isAdmin: false,
  })),
  requireAuth: vi.fn(async () => ({ id: MOCK_USER_ID })),
}));

const CATEGORY_FIXTURE = [
  { id: "uuid-power-tools", name: "Power Tools" },
  { id: "uuid-misc", name: "Miscellaneous" },
];
vi.mock("@/dal", () => ({
  listingDAL: {
    getListingCategories: vi.fn(async () => CATEGORY_FIXTURE),
  },
}));

const analyzeListingImageMock = vi.fn();
vi.mock("@/services/openai/analyze-listing-image", () => ({
  analyzeListingImage: (...args: unknown[]) => analyzeListingImageMock(...args),
}));

// Imported after mocks are registered.
import { POST } from "./route";

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/listings/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawResponse(overrides: Record<string, unknown> = {}) {
  return {
    name: "DeWalt 20V Cordless Drill",
    description: "Solid cordless drill.",
    categoryName: "Power Tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good",
    specifications: { power: "20V MAX" },
    instructions: "",
    safetyNotes: "",
    ...overrides,
  };
}

const SAMPLE_BODY = { imageUrls: ["data:image/jpeg;base64,AAAA"] };

function lastLogPayload() {
  return loggerInfo.mock.calls[loggerInfo.mock.calls.length - 1][0] as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
  analyzeListingImageMock.mockReset();
  loggerInfo.mockReset();
});

describe("analyze-image route logging (Req 9.4 / 12.2)", () => {
  it("logs the canonical fields on a successful request", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(rawResponse());
    await POST(jsonRequest(SAMPLE_BODY));

    const payload = lastLogPayload();
    expect(payload.event).toBe("ai_analyze_request");
    expect(payload.userId).toBe(MOCK_USER_ID);
    expect(payload.photoCount).toBe(1);
    expect(typeof payload.latencyMs).toBe("number");
    expect(payload.rateLimitTokensRemaining).toBe(9);
    expect(payload.parseSucceeded).toBe(true);
    expect(payload.categoryResolved).toBe(true);
    expect(payload.conditionResolved).toBe(true);
    expect(payload.outcome).toBe("success");
  });

  it("logs categoryResolved=false when AI returned an unknown category", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(
      rawResponse({ categoryName: "Heavy Machinery" }),
    );
    await POST(jsonRequest(SAMPLE_BODY));

    expect(lastLogPayload().categoryResolved).toBe(false);
    expect(lastLogPayload().conditionResolved).toBe(true);
    expect(lastLogPayload().outcome).toBe("success");
  });

  it("logs conditionResolved=false on legacy 'excellent'", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(
      rawResponse({ condition: "excellent" }),
    );
    await POST(jsonRequest(SAMPLE_BODY));

    expect(lastLogPayload().conditionResolved).toBe(false);
    expect(lastLogPayload().categoryResolved).toBe(true);
  });

  it("logs outcome=low_confidence when the route falls into the post-resolve null branch", async () => {
    // No name AND no resolvable category → low_confidence.
    analyzeListingImageMock.mockResolvedValueOnce({ totally: "wrong shape" });
    await POST(jsonRequest(SAMPLE_BODY));

    const payload = lastLogPayload();
    expect(payload.outcome).toBe("low_confidence");
    // Token was refunded — confirm we logged the post-refund (decremented)
    // count from `consume`, not a post-refund recount.
    expect(payload.rateLimitTokensRemaining).toBe(9);
  });

  it("logs outcome=rate_limited and no AI call when the bucket is empty", async () => {
    analyzeListingImageMock.mockResolvedValue(rawResponse());
    // Burn the bucket.
    for (let i = 0; i < 10; i++) await POST(jsonRequest(SAMPLE_BODY));
    loggerInfo.mockReset();

    await POST(jsonRequest(SAMPLE_BODY));

    const payload = lastLogPayload();
    expect(payload.outcome).toBe("rate_limited");
    expect(payload.rateLimitTokensRemaining).toBe(0);
  });

  it("logs latencyMs as a non-negative number even on a thrown AI call", async () => {
    analyzeListingImageMock.mockRejectedValueOnce(new Error("upstream 500"));
    await POST(jsonRequest(SAMPLE_BODY));

    const payload = lastLogPayload();
    expect(payload.outcome).toBe("error");
    expect(typeof payload.latencyMs).toBe("number");
    expect(payload.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

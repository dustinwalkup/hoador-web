import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { __resetForTests } from "@/lib/api/ai-rate-limit";

import { POST } from "./route";

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
  { id: "uuid-hand-tools", name: "Hand Tools" },
  { id: "uuid-gardening", name: "Gardening" },
  { id: "uuid-ladders", name: "Ladders & Access" },
  { id: "uuid-construction", name: "Construction" },
  { id: "uuid-cleaning", name: "Cleaning" },
  { id: "uuid-automotive", name: "Automotive" },
  { id: "uuid-party", name: "Party Equipment" },
  { id: "uuid-kids", name: "Kids & Baby" },
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
    description: "A solid cordless drill for home and contractor use.",
    categoryName: "Power Tools",
    brand: "DeWalt",
    model: "DCD777C2",
    condition: "good",
    specifications: { power: "20V MAX" },
    instructions: "Insert battery, pull trigger.",
    safetyNotes: "Wear safety glasses.",
    ...overrides,
  };
}

const SAMPLE_BODY = {
  imageUrls: ["data:image/jpeg;base64,AAAA"],
};

describe("POST /api/listings/analyze-image", () => {
  beforeEach(() => {
    __resetForTests();
    vi.clearAllMocks();
    analyzeListingImageMock.mockReset();
  });

  it("happy path: returns a resolved AiDraft with categoryId and condition", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(rawResponse());

    const res = await POST(jsonRequest(SAMPLE_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      name: "DeWalt 20V Cordless Drill",
      categoryId: "uuid-power-tools",
      condition: "good",
      brand: "DeWalt",
      model: "DCD777C2",
    });
    // Resolved category replaces the raw categoryName — clients should not see it.
    expect(json.data.categoryName).toBeUndefined();
  });

  it("legacy 'excellent' condition coerces to null (Req 5.5)", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(
      rawResponse({ condition: "excellent" }),
    );

    const res = await POST(jsonRequest(SAMPLE_BODY));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.condition).toBeNull();
  });

  it("unknown category name resolves to categoryId: null (Req 5.3)", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(
      rawResponse({ categoryName: "Heavy Machinery" }),
    );

    const res = await POST(jsonRequest(SAMPLE_BODY));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.categoryId).toBeNull();
  });

  it("OpenAI throw is refunded so the failure does not eat quota", async () => {
    analyzeListingImageMock.mockRejectedValueOnce(new Error("OpenAI 500"));

    const res = await POST(jsonRequest(SAMPLE_BODY));
    expect(res.status).toBe(500);

    // Replay 10 more successful calls — if the failure had eaten a token, the
    // 10th would fail. We expect 10 to succeed.
    analyzeListingImageMock.mockResolvedValue(rawResponse());
    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonRequest(SAMPLE_BODY));
      expect(ok.status).toBe(200);
    }
  });

  it("malformed AI JSON returns data: null AND refunds the token (Req 9.1)", async () => {
    analyzeListingImageMock.mockResolvedValueOnce({ totally: "wrong shape" });

    const res = await POST(jsonRequest(SAMPLE_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: null });

    // Replay 10 valid calls to prove the refund happened.
    analyzeListingImageMock.mockResolvedValue(rawResponse());
    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonRequest(SAMPLE_BODY));
      expect(ok.status).toBe(200);
    }
  });

  it("returns 429 on the 11th call within the window (Req 4.5)", async () => {
    analyzeListingImageMock.mockResolvedValue(rawResponse());

    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonRequest(SAMPLE_BODY));
      expect(ok.status).toBe(200);
    }

    const eleventh = await POST(jsonRequest(SAMPLE_BODY));
    expect(eleventh.status).toBe(429);
    const json = await eleventh.json();
    expect(json.error).toBe("rate_limited");
    // The 11th must not even invoke OpenAI.
    expect(analyzeListingImageMock).toHaveBeenCalledTimes(10);
  });

  it("passes every active category name into the prompt context (Req 5.4)", async () => {
    analyzeListingImageMock.mockResolvedValueOnce(rawResponse());

    await POST(jsonRequest(SAMPLE_BODY));

    expect(analyzeListingImageMock).toHaveBeenCalledOnce();
    const [, opts] = analyzeListingImageMock.mock.calls[0] as [
      unknown,
      { categoryNames: string[]; conditionEnum: readonly string[] },
    ];
    expect(opts.categoryNames).toEqual(CATEGORY_FIXTURE.map((c) => c.name));
    expect(opts.conditionEnum).toEqual(["new", "good", "fair", "poor"]);
  });

  it("returns 400 when the body fails schema validation", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
    // The aborted request should not eat quota.
    analyzeListingImageMock.mockResolvedValue(rawResponse());
    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonRequest(SAMPLE_BODY));
      expect(ok.status).toBe(200);
    }
  });
});

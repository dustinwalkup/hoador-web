import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (fn: (req: NextRequest) => Promise<Response>) => fn,
}));

const mockAppend = vi.fn().mockResolvedValue({});

vi.mock("googleapis", () => {
  // Must use `function` for constructor compatibility
  function MockOAuth2() {
    return { setCredentials: vi.fn() };
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      sheets: vi.fn().mockReturnValue({
        spreadsheets: {
          values: {
            append: (...args: unknown[]) => mockAppend(...args),
          },
        },
      }),
    },
  };
});

const mockSendEmail = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/features/notifications/utils/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/api/route-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/route-helpers")>();
  return {
    ...actual,
    captureNonCriticalError: vi.fn(),
  };
});

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/hoa-inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  hoaName: "Sunset Ridge HOA",
  city: "Austin",
  state: "TX",
  name: "John Doe",
  email: "john@example.com",
};

describe("POST /api/hoa-inquiries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEETS_CLIENT_ID = "test-id";
    process.env.GOOGLE_SHEETS_CLIENT_SECRET = "test-secret";
    process.env.GOOGLE_SHEETS_REFRESH_TOKEN = "test-token";
    process.env.GOOGLE_SHEETS_ID = "test-sheet-id";
  });

  it("returns 200 on successful submission", async () => {
    const res = await POST(jsonRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockAppend).toHaveBeenCalledOnce();
  });

  it("writes correct data to Google Sheets", async () => {
    await POST(jsonRequest(validBody));

    const call = mockAppend.mock.calls[0][0];
    expect(call.spreadsheetId).toBe("test-sheet-id");
    expect(call.range).toBe("Sheet1!A:J");

    const row = call.requestBody.values[0];
    // row[0] is timestamp
    expect(row[1]).toBe("Sunset Ridge HOA");
    expect(row[2]).toBe("Austin");
    expect(row[3]).toBe("TX");
    expect(row[4]).toBe("John Doe");
    expect(row[5]).toBe("john@example.com");
  });

  it("sends team notification email after successful write", async () => {
    await POST(jsonRequest(validBody));

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain("Sunset Ridge HOA");
    expect(emailCall.subject).toContain("Austin");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(jsonRequest({ hoaName: "Test" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeDefined();
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      jsonRequest({ ...validBody, email: "not-an-email" }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for invalid state", async () => {
    const res = await POST(jsonRequest({ ...validBody, state: "XX" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
  });

  it("succeeds even if email notification fails", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("Email service down"));

    const res = await POST(jsonRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 500 when Google Sheets write fails", async () => {
    mockAppend.mockRejectedValueOnce(new Error("Sheets API error"));

    const res = await POST(jsonRequest(validBody));

    expect(res.status).toBe(500);
  });

  it("handles optional fields correctly", async () => {
    const bodyWithOptionals = {
      ...validBody,
      phone: "5551234567",
      hoaContactName: "Jane",
      hoaContactEmail: "jane@hoa.com",
      hoaContactPhone: "5559876543",
    };

    const res = await POST(jsonRequest(bodyWithOptionals));
    expect(res.status).toBe(200);

    const row = mockAppend.mock.calls[0][0].requestBody.values[0];
    expect(row[6]).toBe("(555) 123-4567");
    expect(row[7]).toBe("Jane");
    expect(row[8]).toBe("jane@hoa.com");
    expect(row[9]).toBe("(555) 987-6543");
  });
});

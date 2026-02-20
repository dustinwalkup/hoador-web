import { describe, it, expect } from "vitest";
import { buildPushPayload } from "../push-payload";
import type { NotificationType } from "../notification-type-map";

describe("push-payload", () => {
  const title = "Test title";
  const body = "Test body";
  const linkUrl = "/dashboard/rental/abc";
  const type: NotificationType = "rental_approved";

  it("returns payload with only type when data is empty", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {});
    expect(result).toEqual({
      title,
      body,
      linkUrl,
      data: { type },
    });
  });

  it("includes rentalId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: "rental-123",
    });
    expect(result.data.rentalId).toBe("rental-123");
    expect(result.data.type).toBe(type);
  });

  it("includes conversationId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, "message_received", {
      conversationId: "conv-456",
    });
    expect(result.data.conversationId).toBe("conv-456");
    expect(result.data.type).toBe("message_received");
  });

  it("includes disputeId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, "dispute_created", {
      disputeId: "dispute-789",
    });
    expect(result.data.disputeId).toBe("dispute-789");
  });

  it("excludes PII and financial data from payload", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: "rental-1",
      renterName: "John Doe",
      ownerName: "Jane Smith",
      totalAmount: "99.99",
      email: "user@example.com",
      phone: "+15551234567",
    });
    expect(result.data).toEqual({
      type,
      rentalId: "rental-1",
    });
    expect((result.data as Record<string, unknown>).renterName).toBeUndefined();
    expect((result.data as Record<string, unknown>).ownerName).toBeUndefined();
    expect(
      (result.data as Record<string, unknown>).totalAmount,
    ).toBeUndefined();
    expect((result.data as Record<string, unknown>).email).toBeUndefined();
    expect((result.data as Record<string, unknown>).phone).toBeUndefined();
  });

  it("excludes non-string reference IDs (only string IDs included)", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: 123 as unknown as string,
      conversationId: null,
    });
    expect(result.data.rentalId).toBeUndefined();
    expect(result.data.conversationId).toBeUndefined();
  });

  it("works with undefined data", () => {
    const result = buildPushPayload(title, body, linkUrl, type);
    expect(result).toEqual({
      title,
      body,
      linkUrl,
      data: { type },
    });
  });
});

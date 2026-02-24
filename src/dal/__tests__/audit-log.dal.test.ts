import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditLogDAL } from "../index";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("AuditLogDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts a row with correct columns", async () => {
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        entityType: "rental_request",
        entityId: "req-123",
        action: "rental_request.created",
        userId: "user-456",
        metadata: { listingId: "listing-1", startDate: "2024-01-01" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        createdAt: new Date("2024-01-15T12:00:00Z"),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await auditLogDAL.create({
        entityType: "rental_request",
        entityId: "req-123",
        action: "rental_request.created",
        userId: "user-456",
        metadata: { listingId: "listing-1", startDate: "2024-01-01" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith({
        entityType: "rental_request",
        entityId: "req-123",
        action: "rental_request.created",
        userId: "user-456",
        metadata: { listingId: "listing-1", startDate: "2024-01-01" },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });
      expect(result).toEqual(mockRow);
    });

    it("inserts with null userId and optional fields when omitted", async () => {
      const mockRow = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        entityType: "webhook",
        entityId: "evt_123",
        action: "webhook.processed",
        userId: null,
        metadata: { eventType: "payment_intent.succeeded" },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date("2024-01-15T12:00:00Z"),
      };

      const mockReturning = vi.fn().mockResolvedValue([mockRow]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await auditLogDAL.create({
        entityType: "webhook",
        entityId: "evt_123",
        action: "webhook.processed",
        metadata: { eventType: "payment_intent.succeeded" },
      });

      expect(mockValues).toHaveBeenCalledWith({
        entityType: "webhook",
        entityId: "evt_123",
        action: "webhook.processed",
        userId: null,
        metadata: { eventType: "payment_intent.succeeded" },
        ipAddress: null,
        userAgent: null,
      });
      expect(result.userId).toBeNull();
      expect(result).toEqual(mockRow);
    });
  });

  describe("append-only API", () => {
    it("exposes only create; no update or delete methods", () => {
      expect(typeof auditLogDAL.create).toBe("function");
      expect("update" in auditLogDAL).toBe(false);
      expect("delete" in auditLogDAL).toBe(false);
    });
  });
});

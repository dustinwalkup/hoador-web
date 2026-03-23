import { describe, it, expect, vi, beforeEach } from "vitest";
import { serviceListingDAL } from "../index";
import { NotFoundError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

const baseListing = {
  id: "listing-1",
  communityId: "comm-1",
  providerId: "prov-1",
  categoryId: "cat-1",
  title: "Lawn care",
  description: "Mowing",
  pricingType: "fixed" as const,
  price: "50.00",
  photos: [] as string[],
  serviceNotes: null as string | null,
  status: "active" as const,
  adminNote: null as string | null,
  rejectionReason: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ServiceListingDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("inserts and returns the created row", async () => {
      const mockReturning = vi.fn().mockResolvedValue([baseListing]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const result = await serviceListingDAL.create({
        communityId: "comm-1",
        providerId: "prov-1",
        categoryId: "cat-1",
        title: "Lawn care",
        description: "Mowing",
        pricingType: "fixed",
        price: "50.00",
        photos: [],
        serviceNotes: null,
        status: "pending_approval",
        adminNote: null,
        rejectionReason: null,
      });

      expect(result).toEqual(baseListing);
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
    });

    it("throws NotFoundError when insert returns no row", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      await expect(
        serviceListingDAL.create({
          communityId: "comm-1",
          providerId: "prov-1",
          categoryId: "cat-1",
          title: "x",
          description: "y",
          pricingType: "fixed",
          price: "1",
          photos: [],
          serviceNotes: null,
          status: "pending_approval",
          adminNote: null,
          rejectionReason: null,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("update", () => {
    it("sets fields, refreshes updatedAt, and returns the row", async () => {
      const updated = { ...baseListing, title: "Updated" };
      const mockReturning = vi.fn().mockResolvedValue([updated]);
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: mockReturning }),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never);

      const result = await serviceListingDAL.update("listing-1", {
        title: "Updated",
      });

      expect(result.title).toBe("Updated");
      expect(mockSet).toHaveBeenCalled();
      const setArg = mockSet.mock.calls[0][0] as { updatedAt: Date };
      expect(setArg.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("getById", () => {
    it("returns listing with category and provider when found", async () => {
      const row = {
        listing: baseListing,
        category: {
          id: "cat-1",
          name: "Yard",
          description: null,
        },
        provider: {
          id: "prov-1",
          firstName: "A",
          lastName: "B",
          profileImageUrl: null,
          email: "a@b.com",
        },
      };
      const mockLimit = vi.fn().mockResolvedValue([row]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const innerJoinUser = vi.fn().mockReturnValue({ where: mockWhere });
      const innerJoinCategory = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinUser });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinCategory });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.getById("listing-1");

      expect(result).toEqual({
        ...baseListing,
        category: row.category,
        provider: row.provider,
      });
    });

    it("returns null when no row", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const innerJoinUser = vi.fn().mockReturnValue({ where: mockWhere });
      const innerJoinCategory = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinUser });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinCategory });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.getById("missing");
      expect(result).toBeNull();
    });
  });

  describe("findByCommunity", () => {
    it("returns only active listings with pagination", async () => {
      const mockOffset = vi.fn().mockResolvedValue([baseListing]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.findByCommunity(
        "comm-1",
        undefined,
        {
          limit: 10,
          offset: 5,
        },
      );

      expect(result).toEqual([baseListing]);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockOffset).toHaveBeenCalledWith(5);
    });

    it("applies category filter when provided", async () => {
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      await serviceListingDAL.findByCommunity("comm-1", {
        categoryId: "cat-9",
      });

      expect(mockWhere).toHaveBeenCalled();
    });

    it("returns empty array when no active listings", async () => {
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.findByCommunity("comm-empty");
      expect(result).toEqual([]);
    });
  });

  describe("findPendingApproval", () => {
    it("returns only pending_approval listings with relations", async () => {
      const row = {
        listing: { ...baseListing, status: "pending_approval" as const },
        category: { id: "cat-1", name: "Yard", description: null },
        provider: {
          id: "prov-1",
          firstName: "A",
          lastName: "B",
          profileImageUrl: null,
          email: "a@b.com",
        },
      };
      const mockOrderBy = vi.fn().mockResolvedValue([row]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const innerJoinUser = vi.fn().mockReturnValue({ where: mockWhere });
      const innerJoinCategory = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinUser });
      const mockFrom = vi
        .fn()
        .mockReturnValue({ innerJoin: innerJoinCategory });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.findPendingApproval();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending_approval");
    });
  });

  describe("findByProvider", () => {
    it("scopes to providerId", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([baseListing]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const result = await serviceListingDAL.findByProvider("prov-1");

      expect(result).toEqual([baseListing]);
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});

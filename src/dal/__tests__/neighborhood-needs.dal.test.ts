import { describe, it, expect, vi, beforeEach } from "vitest";
import { neighborhoodNeedsDAL } from "../index";
import { ConflictError, NotFoundError } from "../errors";
import { db } from "@/db/db";

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date("2026-01-01T00:00:00Z");

const mockNeed = {
  id: "need-1",
  createdByUserId: "user-1",
  communityId: "community-1",
  type: "rental" as const,
  categoryId: "cat-1",
  title: "Need a drill",
  description: "For one weekend",
  neededStartDate: "2026-02-01",
  neededEndDate: "2026-02-03",
  status: "open" as const,
  closeReason: null,
  closedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

const mockLink = {
  id: "link-1",
  neighborhoodNeedId: "need-1",
  listingType: "rental" as const,
  listingId: "listing-1",
  createdAt: now,
};

// ---------------------------------------------------------------------------
// Helper to build a Drizzle select chain mock
// ---------------------------------------------------------------------------
function buildSelectChain(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const offset = vi.fn().mockReturnValue({ limit });
  const orderBy = vi.fn().mockReturnValue({ limit, offset });
  const where = vi.fn().mockReturnValue({ limit, orderBy, offset });
  const from = vi.fn().mockReturnValue({ where, orderBy, limit });
  vi.mocked(db.select).mockReturnValue({ from } as any);
  return { from, where, orderBy, limit, offset };
}

function buildInsertChain(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const values = vi.fn().mockReturnValue({ returning });
  vi.mocked(db.insert).mockReturnValue({ values } as any);
  return { values, returning };
}

function buildUpdateChain(result: unknown[]) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  vi.mocked(db.update).mockReturnValue({ set } as any);
  return { set, where, returning };
}

// ---------------------------------------------------------------------------

describe("NeighborhoodNeedsDAL", () => {
  beforeEach(() => vi.clearAllMocks());

  // -------------------------------------------------------------------------
  // createNeed
  // -------------------------------------------------------------------------
  describe("createNeed", () => {
    it("inserts and returns the new need", async () => {
      buildInsertChain([mockNeed]);

      const result = await neighborhoodNeedsDAL.createNeed(mockNeed);

      expect(result).toEqual(mockNeed);
      expect(db.insert).toHaveBeenCalled();
    });

    it("propagates DB errors", async () => {
      const returning = vi.fn().mockRejectedValue(new Error("db error"));
      const values = vi.fn().mockReturnValue({ returning });
      vi.mocked(db.insert).mockReturnValue({ values } as any);

      await expect(neighborhoodNeedsDAL.createNeed(mockNeed)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getNeedById
  // -------------------------------------------------------------------------
  describe("getNeedById", () => {
    it("returns the need when found", async () => {
      buildSelectChain([mockNeed]);

      const result = await neighborhoodNeedsDAL.getNeedById("need-1");

      expect(result).toEqual(mockNeed);
    });

    it("returns null when not found", async () => {
      buildSelectChain([]);

      const result = await neighborhoodNeedsDAL.getNeedById("missing");

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getNeedByIdIncludingDeleted
  // -------------------------------------------------------------------------
  describe("getNeedByIdIncludingDeleted", () => {
    it("returns the need regardless of deleted_at", async () => {
      const deletedNeed = { ...mockNeed, deletedAt: now };
      buildSelectChain([deletedNeed]);

      const result =
        await neighborhoodNeedsDAL.getNeedByIdIncludingDeleted("need-1");

      expect(result).toEqual(deletedNeed);
    });

    it("returns null when not found", async () => {
      buildSelectChain([]);
      const result =
        await neighborhoodNeedsDAL.getNeedByIdIncludingDeleted("missing");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // updateNeed
  // -------------------------------------------------------------------------
  describe("updateNeed", () => {
    it("updates and returns the need", async () => {
      const updated = { ...mockNeed, title: "Updated title" };
      buildUpdateChain([updated]);

      const result = await neighborhoodNeedsDAL.updateNeed("need-1", {
        title: "Updated title",
      });

      expect(result.title).toBe("Updated title");
    });

    it("throws NotFoundError when row is not returned", async () => {
      buildUpdateChain([]);

      await expect(
        neighborhoodNeedsDAL.updateNeed("missing", { title: "x" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // closeNeed — idempotent
  // -------------------------------------------------------------------------
  describe("closeNeed", () => {
    it("sets status=closed and closeReason", async () => {
      const closed = {
        ...mockNeed,
        status: "closed" as const,
        closeReason: "manual" as const,
      };
      buildUpdateChain([closed]);

      const result = await neighborhoodNeedsDAL.closeNeed("need-1", "manual");

      expect(result.status).toBe("closed");
      expect(result.closeReason).toBe("manual");
    });

    it("is idempotent — calling on already-closed need returns the row", async () => {
      const alreadyClosed = {
        ...mockNeed,
        status: "closed" as const,
        closeReason: "booking" as const,
      };
      buildUpdateChain([alreadyClosed]);

      const result = await neighborhoodNeedsDAL.closeNeed("need-1", "booking");

      expect(result.status).toBe("closed");
    });

    it("throws NotFoundError when id does not exist", async () => {
      buildUpdateChain([]);

      await expect(
        neighborhoodNeedsDAL.closeNeed("missing", "manual"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // softDeleteNeed
  // -------------------------------------------------------------------------
  describe("softDeleteNeed", () => {
    it("sets deleted_at on the need", async () => {
      const returning = vi.fn().mockResolvedValue([{ id: "need-1" }]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      await expect(
        neighborhoodNeedsDAL.softDeleteNeed("need-1"),
      ).resolves.toBeUndefined();
    });

    it("throws NotFoundError when no row is updated", async () => {
      const returning = vi.fn().mockResolvedValue([]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      vi.mocked(db.update).mockReturnValue({ set } as any);

      await expect(
        neighborhoodNeedsDAL.softDeleteNeed("missing"),
      ).rejects.toThrow(NotFoundError);
    });

    it("hides the need from getNeedById after soft-delete", async () => {
      // getNeedById filters by deletedAt IS NULL — simulate not found
      buildSelectChain([]);

      const result = await neighborhoodNeedsDAL.getNeedById("need-1");

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // listFeed
  // -------------------------------------------------------------------------
  describe("listFeed", () => {
    it("returns empty result without hitting DB when visibleCommunityIds is empty", async () => {
      const result = await neighborhoodNeedsDAL.listFeed(
        [],
        {},
        { page: 1, limit: 10 },
      );

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it("returns paginated feed rows when communities are provided", async () => {
      const feedRow = { ...mockNeed, linked_listing_count: "2" };
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [feedRow] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "1" }] } as any);

      const result = await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        { openOnly: true },
        { page: 1, limit: 10 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].linkedListingCount).toBe(2);
      expect(result.pagination.total).toBe(1);
      expect(db.execute).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // listNeedsByUser
  // -------------------------------------------------------------------------
  describe("listNeedsByUser", () => {
    it("returns needs for the given user", async () => {
      // Data query: select → from → where → orderBy → limit → offset [terminal]
      const dataOffset = vi.fn().mockResolvedValue([mockNeed]);
      const dataLimit = vi.fn().mockReturnValue({ offset: dataOffset });
      const dataOrderBy = vi.fn().mockReturnValue({ limit: dataLimit });
      const dataWhere = vi.fn().mockReturnValue({ orderBy: dataOrderBy });
      const dataFrom = vi.fn().mockReturnValue({ where: dataWhere });

      // Count query: select → from → where [terminal]
      const countWhere = vi.fn().mockResolvedValue([{ total: 1 }]);
      const countFrom = vi.fn().mockReturnValue({ where: countWhere });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: dataFrom } as any)
        .mockReturnValueOnce({ from: countFrom } as any);

      const result = await neighborhoodNeedsDAL.listNeedsByUser("user-1", {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // countOpenVisibleNeeds
  // -------------------------------------------------------------------------
  describe("countOpenVisibleNeeds", () => {
    it("returns 0 without hitting DB when visibleCommunityIds is empty", async () => {
      const result = await neighborhoodNeedsDAL.countOpenVisibleNeeds([]);
      expect(result).toBe(0);
      expect(db.select).not.toHaveBeenCalled();
    });

    it("returns the count when communities are provided", async () => {
      const where = vi.fn().mockResolvedValue([{ total: 5 }]);
      const from = vi.fn().mockReturnValue({ where });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await neighborhoodNeedsDAL.countOpenVisibleNeeds([
        "c-1",
        "c-2",
      ]);

      expect(result).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // linkListing
  // -------------------------------------------------------------------------
  describe("linkListing", () => {
    it("inserts and returns the link row", async () => {
      buildInsertChain([mockLink]);

      const result = await neighborhoodNeedsDAL.linkListing({
        neighborhoodNeedId: "need-1",
        listingType: "rental",
        listingId: "listing-1",
      });

      expect(result).toEqual(mockLink);
    });

    it("throws ConflictError on unique constraint violation", async () => {
      const returning = vi.fn().mockRejectedValue({ code: "23505" });
      const values = vi.fn().mockReturnValue({ returning });
      vi.mocked(db.insert).mockReturnValue({ values } as any);

      await expect(
        neighborhoodNeedsDAL.linkListing({
          neighborhoodNeedId: "need-1",
          listingType: "rental",
          listingId: "listing-1",
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  // -------------------------------------------------------------------------
  // getLinkByListing
  // -------------------------------------------------------------------------
  describe("getLinkByListing", () => {
    it("returns the link row when found", async () => {
      buildSelectChain([mockLink]);

      const result = await neighborhoodNeedsDAL.getLinkByListing(
        "rental",
        "listing-1",
      );

      expect(result).toEqual(mockLink);
    });

    it("returns null when not found", async () => {
      buildSelectChain([]);

      const result = await neighborhoodNeedsDAL.getLinkByListing(
        "rental",
        "missing",
      );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findOpenNeedsLinkedToListing
  // -------------------------------------------------------------------------
  describe("findOpenNeedsLinkedToListing", () => {
    it("returns open needs linked to the listing", async () => {
      const where = vi.fn().mockResolvedValue([{ need: mockNeed }]);
      const innerJoin = vi.fn().mockReturnValue({ where });
      const from = vi.fn().mockReturnValue({ innerJoin });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await neighborhoodNeedsDAL.findOpenNeedsLinkedToListing(
        "rental",
        "listing-1",
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("need-1");
    });

    it("returns empty array when no open needs linked", async () => {
      const where = vi.fn().mockResolvedValue([]);
      const innerJoin = vi.fn().mockReturnValue({ where });
      const from = vi.fn().mockReturnValue({ innerJoin });
      vi.mocked(db.select).mockReturnValue({ from } as any);

      const result = await neighborhoodNeedsDAL.findOpenNeedsLinkedToListing(
        "service",
        "listing-x",
      );

      expect(result).toEqual([]);
    });
  });
});

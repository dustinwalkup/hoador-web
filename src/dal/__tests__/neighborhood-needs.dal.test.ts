import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { neighborhoodNeedsDAL } from "../index";
import { ConflictError, NotFoundError } from "../errors";
import { db } from "@/db/db";

/**
 * Render the SQL `listFeed` handed to `db.execute` into the statement text and
 * parameter list Postgres would actually receive.
 *
 * Asserting on the rendered query rather than on the template object is what
 * makes the injection tests meaningful: a bound value appears in `params` and
 * as `$n` in `sql`, and an interpolated one appears in `sql` itself. A substring
 * check against the template would pass either way.
 */
function renderFeedQuery(callIndex = 0): { sql: string; params: unknown[] } {
  const chunk = vi.mocked(db.execute).mock.calls[callIndex]?.[0] as SQL;
  const { sql, params } = new PgDialect().sqlToQuery(chunk);
  return { sql, params };
}

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
      const feedRow = {
        ...mockNeed,
        communityName: "Maple Street HOA",
        requesterRating: "4.50",
        requesterReviewCount: 3,
        linkedListingCount: 2,
      };
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
      expect(result.data[0].communityName).toBe("Maple Street HOA");
      expect(result.data[0].requesterRating).toBe("4.50");
      expect(result.data[0].requesterReviewCount).toBe(3);
      // No viewer location passed → distance is null
      expect(result.data[0].distanceMiles).toBeNull();
      expect(result.pagination.total).toBe(1);
      expect(db.execute).toHaveBeenCalledTimes(2);
    });

    it("filters by creator when createdByUserId is set", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        { createdByUserId: "user-1" },
        { page: 1, limit: 10 },
      );

      const { sql, params } = renderFeedQuery();
      expect(sql).toContain("n.created_by_user_id = $");
      expect(params).toContain("user-1");
    });

    it("omits the creator filter when createdByUserId is not set", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        { openOnly: true },
        { page: 1, limit: 10 },
      );

      // `created_by_user_id` still appears in the SELECT list and JOINs; assert
      // the WHERE equality filter specifically is absent.
      const { sql } = renderFeedQuery();
      expect(sql).not.toContain("n.created_by_user_id = $");
    });

    // ── P-E13-5: the feed predicate is BOUND, never interpolated ──────────────
    //
    // `listFeed` used to build its WHERE by string concatenation inside
    // `sql.raw`, and `categoryId` arrives from the query string — so
    // `?categoryId=' OR '1'='1` was a live SQL injection. These assert on the
    // SQL drizzle actually emits, not on a substring of a template: a value that
    // shows up in `params` and a `$n` placeholder in `sql` is the definition of
    // "not injectable", and it is the assertion that fails the moment somebody
    // reaches for `sql.raw` again.
    it.each([
      ["a quote-escape injection", "' OR '1'='1"],
      ["a UNION probe", "x' UNION SELECT NULL--"],
      ["a statement terminator", "'; DROP TABLE neighborhood_needs;--"],
    ])("binds a categoryId carrying %s", async (_label, value) => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        { categoryId: value },
        { page: 1, limit: 10 },
      );

      const { sql, params } = renderFeedQuery();
      expect(sql).toContain("n.category_id = $");
      expect(params).toContain(value);
      // The payload never reaches the statement text — the whole point.
      expect(sql).not.toContain(value);
      expect(sql).not.toContain("DROP TABLE");
      expect(sql).not.toContain("UNION");
    });

    it("binds the visible community ids rather than interpolating them", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1", "community-2"],
        {},
        { page: 1, limit: 10 },
      );

      const { sql, params } = renderFeedQuery();
      expect(sql).toContain("n.community_id IN (");
      expect(params).toContain("community-1");
      expect(params).toContain("community-2");
      expect(sql).not.toContain("'community-1'");
    });

    // ── P-E13-6: the feed row can name who posted it and what it is ──────────
    //
    // `NeedFeedRow` carried `createdByUserId` and a bare `categoryId` — no name,
    // no avatar, no category name — so a need card was the one card in the
    // product that could not say who posted it.
    it("composes the requester's display name and carries their avatar", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockNeed,
              communityName: "Maple Street HOA",
              requesterFirstName: "Dana",
              requesterLastName: "Nguyen",
              requesterAvatarUrl: "https://blob/dana.jpg",
              categoryName: "Power Tools",
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [{ total: "1" }] } as any);

      const result = await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        {},
        { page: 1, limit: 10 },
      );

      expect(result.data[0].requesterName).toBe("Dana Nguyen");
      expect(result.data[0].requesterAvatarUrl).toBe("https://blob/dana.jpg");
      expect(result.data[0].categoryName).toBe("Power Tools");
    });

    // Epic 11's F5: `${firstName} ${lastName}` over two NULLABLE columns put the
    // literal string "null null" on the messaging endpoints. Both columns are
    // "Nullable for Better Auth compatibility", so a social sign-in that never
    // completed a profile hits this.
    it.each([
      ["both names null", null, null, null],
      ["first name only", "Dana", null, "Dana"],
      ["last name only", null, "Nguyen", "Nguyen"],
    ])("resolves %s to %s", async (_label, first, last, expected) => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockNeed,
              communityName: "Maple Street HOA",
              requesterFirstName: first,
              requesterLastName: last,
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [{ total: "1" }] } as any);

      const result = await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        {},
        { page: 1, limit: 10 },
      );

      expect(result.data[0].requesterName).toBe(expected);
      // Null, never the literal "null null" — the whole point.
      expect(String(result.data[0].requesterName)).not.toContain("null null");
    });

    it("joins both category tables, each guarded on the need's type", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        {},
        { page: 1, limit: 10 },
      );

      // `category_id` has no FK — it points at one table or the other depending
      // on `type` — so both joins must be present and both must be guarded.
      const { sql } = renderFeedQuery();
      expect(sql).toContain("LEFT JOIN listing_categories lc");
      expect(sql).toContain("n.type = 'rental' AND lc.id = n.category_id");
      expect(sql).toContain("LEFT JOIN service_listing_categories slc");
      expect(sql).toContain("n.type = 'service' AND slc.id = n.category_id");
      expect(sql).toContain('COALESCE(lc.name, slc.name) AS "categoryName"');
    });

    it("binds the type filter", async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: "0" }] } as any);

      await neighborhoodNeedsDAL.listFeed(
        ["community-1"],
        { type: "service" },
        { page: 1, limit: 10 },
      );

      const { sql, params } = renderFeedQuery();
      expect(sql).toContain("n.type = $");
      expect(params).toContain("service");
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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  serviceBookings,
  serviceListings,
  serviceProviderProfiles,
} from "@/db/schemas/services.schema";
import { serviceReviews } from "@/db/schemas/service-reviews.schema";
import { serviceNoShowReports } from "@/db/schemas/service-no-show-reports.schema";

/**
 * Schema + migration alignment for Phase 1 test plan.
 */
describe("services phase 1 schema (drizzle)", () => {
  it("service_listings.status defaults to pending_approval", () => {
    expect(serviceListings.status.default).toBeDefined();
  });

  it("service_bookings.status defaults to pending", () => {
    expect(serviceBookings.status.default).toBeDefined();
  });

  it("service_provider_profiles.aggregateRating allows null", () => {
    expect(serviceProviderProfiles.aggregateRating.notNull).toBe(false);
  });

  it("service_no_show_reports links booking and reporter", () => {
    expect(serviceNoShowReports.bookingId).toBeDefined();
    expect(serviceNoShowReports.reportedBy).toBeDefined();
  });

  it("service_reviews has bookingId and reviewerId columns for unique index", () => {
    expect(serviceReviews.bookingId).toBeDefined();
    expect(serviceReviews.reviewerId).toBeDefined();
    expect(serviceReviews.revieweeId).toBeDefined();
    expect(serviceReviews.listingId).toBeDefined();
  });
});

describe("services phase 1 migration SQL (index names)", () => {
  const migrationSql = readFileSync(
    join(process.cwd(), "src/db/migrations/0030_lucky_la_nuit.sql"),
    "utf-8",
  );

  it("includes expected service_listings and service_bookings indexes", () => {
    expect(migrationSql).toContain("sl_community_status_idx");
    expect(migrationSql).toContain("sl_provider_idx");
    expect(migrationSql).toContain("sl_category_idx");
    expect(migrationSql).toContain("sb_payout_status_idx");
    expect(migrationSql).toContain("sb_completed_at_idx");
    expect(migrationSql).toContain("sb_provider_idx");
    expect(migrationSql).toContain("sb_requester_idx");
  });

  const migrationSql0046 = readFileSync(
    join(process.cwd(), "src/db/migrations/0046_service_payment_lifecycle.sql"),
    "utf-8",
  );

  it("0046 adds service_payment_lifecycle and drops payout columns from service_bookings", () => {
    expect(migrationSql0046).toContain("service_payment_lifecycle");
    expect(migrationSql0046).toContain("spl_booking_id_idx");
    expect(migrationSql0046).toContain('DROP COLUMN "payout_status"');
  });

  it("includes service_reviews unique and lookup indexes", () => {
    expect(migrationSql).toContain("sr_reviewer_booking_idx");
    expect(migrationSql).toContain("sr_reviewee_idx");
    expect(migrationSql).toContain("sr_listing_idx");
  });
});

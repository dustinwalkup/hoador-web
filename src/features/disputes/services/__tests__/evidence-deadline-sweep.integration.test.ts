import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { auditLogDAL, disputeDAL } from "@/dal";
import { EVIDENCE_WINDOW_MS } from "@/dal/dispute.dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import {
  createServiceBooking,
  createServiceListing,
  createUser,
} from "@/test/integration/factories";
import {
  REMINDER_ACTION,
  runEvidenceDeadlineSweep,
} from "../evidence-deadline-sweep";

/**
 * P-E13-9 against a real Postgres: the sweep's SQL, its zone handling, the
 * compare-and-set transition and the jsonb reminder marker. A mocked `db`
 * would pass whatever SQL these build (the needs-feed lesson).
 *
 * Notifications are mocked at `sendNotification`, so nothing is emailed or
 * pushed; everything below it (parties, emails, markers) is real.
 */
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(async () => ({ success: true })),
}));

// West of UTC on purpose. The deadline columns are zoneless UTC wall clock,
// and a bare `Date` bound inside raw SQL is serialized in the LOCAL zone, which
// would shift the reminder window by five hours. On a UTC machine that bug is
// invisible, so the zone is pinned rather than inherited.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Chicago";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const HOUR = 60 * 60 * 1000;
// Whole seconds: the column keeps microseconds, JS keeps milliseconds.
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

type Status = (typeof schema.disputes.$inferInsert)["status"];

async function dispute(
  status: Status,
  evidenceDeadline: Date | null,
  additionalEvidenceDeadline: Date | null = null,
) {
  const provider = await createUser();
  const requester = await createUser();
  const listing = await createServiceListing(provider.id);
  const booking = await createServiceBooking(listing, requester.id);
  const [row] = await db
    .insert(schema.disputes)
    .values({
      serviceBookingId: booking.id,
      createdBy: requester.id,
      createdByRole: "requester",
      reasonCode: "quality_issue",
      description: "Integration-test dispute",
      policyVersion: "v1",
      status,
      evidenceDeadline,
      additionalEvidenceDeadline,
    })
    .returning();
  return { ...row, providerId: provider.id, requesterId: requester.id };
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: schema.disputes.status })
    .from(schema.disputes)
    .where(eq(schema.disputes.id, id));
  return row.status;
}

beforeEach(() => {
  vi.mocked(sendNotification).mockClear();
});

describe("disputeDAL.listActiveEvidenceDeadlinesBetween", () => {
  it("finds the ACTIVE deadline in (now, now + 24h], per status", async () => {
    const soon = await dispute("evidence_requested", at(10));
    const lateInDay = await dispute("evidence_requested", at(20));
    await dispute("evidence_requested", at(30)); // too far
    await dispute("evidence_requested", at(-1)); // already past
    // Under review: the extension is the active deadline, the old one ignored.
    const extended = await dispute("under_review", at(-72), at(5));
    const noExtension = await dispute("under_review", at(22));
    await dispute("under_review", at(3), at(40)); // extension far off
    await dispute("open", at(2)); // takes no evidence
    await dispute("resolved", at(2));

    const found = await disputeDAL.listActiveEvidenceDeadlinesBetween(
      NOW,
      at(24),
    );

    // Ordered by deadline, each with the deadline the evidence route enforces.
    expect(found).toEqual([
      { id: extended.id, status: "under_review", deadline: at(5) },
      { id: soon.id, status: "evidence_requested", deadline: at(10) },
      { id: lateInDay.id, status: "evidence_requested", deadline: at(20) },
      { id: noExtension.id, status: "under_review", deadline: at(22) },
    ]);
  });
});

describe("disputeDAL.listExpiredEvidenceRequests", () => {
  it("finds evidence requests at or past their deadline, and nothing else", async () => {
    const expired = await dispute("evidence_requested", at(-2));
    await dispute("evidence_requested", at(2));
    await dispute("under_review", at(-2)); // already where expiry sends it
    await dispute("evidence_requested", null);

    expect(await disputeDAL.listExpiredEvidenceRequests(NOW)).toEqual([
      expired.id,
    ]);
  });
});

describe("disputeDAL.transitionIfStatus", () => {
  it("moves only from the expected status", async () => {
    const d = await dispute("evidence_requested", at(-1));

    expect(
      await disputeDAL.transitionIfStatus(d.id, "open", "under_review"),
    ).toBe(false);
    expect(await statusOf(d.id)).toBe("evidence_requested");

    expect(
      await disputeDAL.transitionIfStatus(
        d.id,
        "evidence_requested",
        "under_review",
      ),
    ).toBe(true);
    expect(await statusOf(d.id)).toBe("under_review");
  });
});

describe("disputeDAL.updateState into evidence_requested", () => {
  it("starts a fresh window, and clears an old extension", async () => {
    // Filed 8 days ago: the filing window is gone, and an earlier review round
    // left an expired extension behind.
    const d = await dispute("under_review", at(-24), at(-2));
    const before = Date.now();

    const updated = await disputeDAL.updateState(d.id, "evidence_requested");

    const window = updated.evidenceDeadline!.getTime() - before;
    expect(window).toBeGreaterThanOrEqual(EVIDENCE_WINDOW_MS - 1000);
    expect(window).toBeLessThan(EVIDENCE_WINDOW_MS + 5000);
    expect(updated.additionalEvidenceDeadline).toBeNull();
    // The fresh deadline is not an expired one to the sweep.
    expect(await disputeDAL.listExpiredEvidenceRequests(new Date())).toEqual(
      [],
    );
  });
});

describe("auditLogDAL.exists", () => {
  it("matches on entity, action and contained metadata", async () => {
    const d = await dispute("evidence_requested", at(5));
    await auditLogDAL.create({
      entityType: "dispute",
      entityId: d.id,
      action: REMINDER_ACTION,
      metadata: { deadline: at(5).toISOString(), sent: 2 },
    });

    const base = {
      entityType: "dispute",
      entityId: d.id,
      action: REMINDER_ACTION,
    };
    expect(
      await auditLogDAL.exists({
        ...base,
        metadata: { deadline: at(5).toISOString() },
      }),
    ).toBe(true);
    expect(
      await auditLogDAL.exists({
        ...base,
        metadata: { deadline: at(6).toISOString() },
      }),
    ).toBe(false);
    expect(
      await auditLogDAL.exists({ ...base, action: "dispute.something_else" }),
    ).toBe(false);
    expect(
      await auditLogDAL.exists({ ...base, entityId: "another-dispute" }),
    ).toBe(false);
  });
});

describe("runEvidenceDeadlineSweep, end to end", () => {
  it("reminds both parties once per deadline, and moves expired requests to review", async () => {
    const due = await dispute("evidence_requested", at(6));
    const expired = await dispute("evidence_requested", at(-1));

    const first = await runEvidenceDeadlineSweep(NOW);

    expect(first).toEqual({
      remindersEligible: 1,
      remindersSent: 1,
      remindersFailed: 0,
      expiredEligible: 1,
      expiredEnforced: 1,
      expiredFailed: 0,
    });
    const calls = vi.mocked(sendNotification).mock.calls.map(([a]) => a);
    const reminded = calls
      .filter((c) => c.type === "dispute_evidence_deadline_approaching")
      .map((c) => c.userId)
      .sort();
    expect(reminded).toEqual([due.providerId, due.requesterId].sort());
    const told = calls
      .filter((c) => c.type === "dispute_evidence_deadline_expired")
      .map((c) => c.userId)
      .sort();
    expect(told).toEqual([expired.providerId, expired.requesterId].sort());
    expect(await statusOf(expired.id)).toBe("under_review");

    // A second run an hour later (or a double run) repeats nothing.
    vi.mocked(sendNotification).mockClear();
    const second = await runEvidenceDeadlineSweep(at(1));

    expect(second.remindersSent).toBe(0);
    expect(second.expiredEnforced).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("reminds again for a NEW deadline after a fresh evidence request", async () => {
    const d = await dispute("evidence_requested", at(6));
    await runEvidenceDeadlineSweep(NOW);

    // Support asks again: fresh 7-day window, which will earn its own reminder.
    await disputeDAL.updateState(d.id, "evidence_requested");
    vi.mocked(sendNotification).mockClear();
    const sixDaysLater = new Date(
      NOW.getTime() + EVIDENCE_WINDOW_MS - 6 * HOUR,
    );
    const result = await runEvidenceDeadlineSweep(sixDaysLater);

    expect(result.remindersSent).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});

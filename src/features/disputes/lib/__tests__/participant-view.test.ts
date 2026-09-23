import { describe, it, expect } from "vitest";
import type { DisputeWithRelations } from "@/dal/types";
import {
  toDisputeTimeline,
  toParticipantDispute,
  toParticipantDisputeListItem,
} from "../participant-view";

const RENTER = "user-renter";
const OWNER = "user-owner";
const ADMIN = "user-admin";

const at = (iso: string) => new Date(iso);

function rentalDispute(
  overrides: Partial<DisputeWithRelations> = {},
): DisputeWithRelations {
  return {
    id: "dispute-1",
    referenceNumber: 1042,
    rentalId: "rental-1",
    serviceBookingId: null,
    createdBy: RENTER,
    createdByRole: "renter",
    reasonCode: "damage",
    description: "The drill came back with a cracked chuck.",
    status: "resolved",
    policyVersion: "v1.2",
    evidenceDeadline: at("2026-03-01T00:00:00Z"),
    additionalEvidenceDeadline: at("2026-03-05T00:00:00Z"),
    resolvedAt: at("2026-03-10T00:00:00Z"),
    resolvedBy: ADMIN,
    resolutionOutcome: "partial_renter",
    resolutionReason: "Split the repair cost.",
    stripeChargebackId: null,
    createdAt: at("2026-02-20T00:00:00Z"),
    updatedAt: at("2026-03-10T00:00:00Z"),
    rental: {
      id: "rental-1",
      requestId: "request-1",
      listingId: "listing-1",
      renterId: RENTER,
      ownerId: OWNER,
      listing: { name: "Hammer drill" },
    },
    serviceBooking: null,
    createdByUser: {
      id: RENTER,
      firstName: "Rita",
      lastName: "Renter",
      email: "rita@example.com",
    },
    resolvedByUser: {
      id: ADMIN,
      firstName: "Ada",
      lastName: "Admin",
      email: "ada@hoador.com",
    },
    evidence: [
      {
        id: "ev-1",
        disputeId: "dispute-1",
        uploadedBy: RENTER,
        uploadedByRole: "renter",
        evidenceType: "image",
        content: "https://blob/evidence-1.jpg",
        uploadedAt: at("2026-02-20T01:00:00Z"),
      },
      {
        id: "ev-2",
        disputeId: "dispute-1",
        uploadedBy: OWNER,
        uploadedByRole: "owner",
        evidenceType: "text",
        content: "It was cracked when they collected it.",
        uploadedAt: at("2026-02-21T01:00:00Z"),
      },
    ],
    auditLogs: [
      {
        id: "log-1",
        disputeId: "dispute-1",
        actionType: "dispute_created",
        userId: RENTER,
        previousState: null,
        newState: null,
        details: { reasonCode: "damage" },
        reason: null,
        createdAt: at("2026-02-20T00:00:00Z"),
      },
      {
        id: "log-2",
        disputeId: "dispute-1",
        actionType: "evidence_uploaded",
        userId: OWNER,
        previousState: null,
        newState: null,
        details: { evidenceId: "ev-2" },
        reason: null,
        createdAt: at("2026-02-21T01:00:00Z"),
      },
      {
        id: "log-3",
        disputeId: "dispute-1",
        actionType: "note_created",
        userId: ADMIN,
        previousState: null,
        newState: null,
        details: { noteId: "note-1" },
        reason: "Renter has two prior damage claims this quarter",
        createdAt: at("2026-02-22T00:00:00Z"),
      },
      {
        id: "log-4",
        disputeId: "dispute-1",
        actionType: "state_change",
        userId: ADMIN,
        previousState: "open",
        newState: "under_review",
        details: null,
        reason: "Escalating, evidence is thin on both sides",
        createdAt: at("2026-02-23T00:00:00Z"),
      },
      {
        id: "log-5",
        disputeId: "dispute-1",
        actionType: "financial_operation",
        userId: ADMIN,
        previousState: null,
        newState: null,
        details: { stripeTransferId: "tr_secret" },
        reason: null,
        createdAt: at("2026-03-09T00:00:00Z"),
      },
      {
        id: "log-6",
        disputeId: "dispute-1",
        actionType: "resolution",
        userId: ADMIN,
        previousState: null,
        newState: null,
        details: null,
        reason: null,
        createdAt: at("2026-03-10T00:00:00Z"),
      },
    ],
    internalNotes: [
      {
        id: "note-1",
        disputeId: "dispute-1",
        adminId: ADMIN,
        content: "Renter has two prior damage claims this quarter.",
        createdAt: at("2026-02-22T00:00:00Z"),
        updatedAt: at("2026-02-22T00:00:00Z"),
      },
    ],
    financialOperations: [
      {
        id: "fin-1",
        disputeId: "dispute-1",
        operationType: "refund_partial",
        amount: "40.00",
        stripeOperationId: "re_1SecretRefund",
        stripePaymentIntentId: "pi_1SecretIntent",
        stripeTransferId: "tr_1SecretTransfer",
        status: "succeeded",
        errorMessage: null,
        performedBy: ADMIN,
        performedAt: at("2026-03-10T00:00:00Z"),
      },
    ],
    ...overrides,
  };
}

function serviceDispute(): DisputeWithRelations {
  return rentalDispute({
    rentalId: null,
    rental: null,
    serviceBookingId: "booking-1",
    serviceBooking: {
      id: "booking-1",
      requesterId: RENTER,
      providerId: OWNER,
      listing: { title: "Gutter cleaning" },
    },
    createdByRole: "requester",
  });
}

describe("toParticipantDispute — what must NOT be on the wire (P-E13-2)", () => {
  // These are the four leaks the route shipped to every renter and owner.
  // Each is asserted on the SERIALIZED payload, because that is the artifact
  // that reaches a released mobile binary — a property that is `undefined` in
  // the object but survives a spread would pass an in-memory check.
  const serialized = () =>
    JSON.stringify(toParticipantDispute(rentalDispute(), RENTER));

  it("omits admin internal notes entirely (Req 19.2.5)", () => {
    const view = toParticipantDispute(rentalDispute(), RENTER);
    expect("internalNotes" in view).toBe(false);
    expect(serialized()).not.toContain("prior damage claims");
    expect(serialized()).not.toContain("note-1");
  });

  it("omits the raw audit log and its admin free-text reasons", () => {
    const view = toParticipantDispute(rentalDispute(), RENTER);
    expect("auditLogs" in view).toBe(false);
    expect(serialized()).not.toContain("Escalating, evidence is thin");
  });

  it("omits every Stripe identifier from financial operations", () => {
    const payload = serialized();
    expect(payload).not.toContain("re_1SecretRefund");
    expect(payload).not.toContain("pi_1SecretIntent");
    expect(payload).not.toContain("tr_1SecretTransfer");
    expect(payload).not.toContain("tr_secret");
  });

  it("omits both participants' email addresses", () => {
    const payload = serialized();
    expect(payload).not.toContain("rita@example.com");
    expect(payload).not.toContain("ada@hoador.com");
    expect(payload).not.toContain("@");
  });

  it("omits admin user ids", () => {
    expect(serialized()).not.toContain(ADMIN);
  });
});

describe("toParticipantDispute — what must survive (Req 19.2.1, 19.2.4)", () => {
  it("keeps status, reference number, reason, description and deadlines", () => {
    const view = toParticipantDispute(rentalDispute(), RENTER);
    expect(view).toMatchObject({
      id: "dispute-1",
      referenceNumber: 1042,
      status: "resolved",
      reasonCode: "damage",
      evidenceDeadline: at("2026-03-01T00:00:00Z"),
      additionalEvidenceDeadline: at("2026-03-05T00:00:00Z"),
    });
    expect(view.description).toContain("cracked chuck");
  });

  it("keeps the resolution outcome and its financial consequence", () => {
    const view = toParticipantDispute(rentalDispute(), RENTER);
    expect(view.resolutionOutcome).toBe("partial_renter");
    expect(view.resolutionReason).toBe("Split the repair cost.");
    expect(view.financialOperations).toEqual([
      {
        id: "fin-1",
        operationType: "refund_partial",
        amount: "40.00",
        status: "succeeded",
        performedAt: at("2026-03-10T00:00:00Z"),
      },
    ]);
  });

  it("keeps evidence, marking which items the viewer uploaded", () => {
    const view = toParticipantDispute(rentalDispute(), RENTER);
    expect(view.evidence).toHaveLength(2);
    expect(view.evidence[0]).toMatchObject({
      id: "ev-1",
      uploadedByYou: true,
      uploadedByRole: "renter",
    });
    expect(view.evidence[1]).toMatchObject({
      id: "ev-2",
      uploadedByYou: false,
    });
    // The uploader's user id is not a fact the viewer needs.
    expect(view.evidence[0]).not.toHaveProperty("uploadedBy");
  });

  it("resolves the rental subject with the request id detail is addressed by", () => {
    expect(toParticipantDispute(rentalDispute(), RENTER).subject).toEqual({
      type: "rental",
      id: "rental-1",
      rentalRequestId: "request-1",
      name: "Hammer drill",
    });
  });

  it("resolves the service-booking subject", () => {
    expect(toParticipantDispute(serviceDispute(), RENTER).subject).toEqual({
      type: "service",
      id: "booking-1",
      rentalRequestId: null,
      name: "Gutter cleaning",
    });
  });

  it("reports who filed it without naming them", () => {
    expect(toParticipantDispute(rentalDispute(), RENTER).filedByYou).toBe(true);
    expect(toParticipantDispute(rentalDispute(), OWNER).filedByYou).toBe(false);
  });
});

describe("toDisputeTimeline", () => {
  it("keeps only participant-visible events, in order", () => {
    const events = toDisputeTimeline(rentalDispute(), RENTER);
    expect(events.map((e) => e.type)).toEqual([
      "filed",
      "evidence_added",
      "state_change",
      "resolved",
    ]);
  });

  it("drops note and financial-operation entries", () => {
    const ids = toDisputeTimeline(rentalDispute(), RENTER).map((e) => e.id);
    expect(ids).not.toContain("log-3"); // note_created
    expect(ids).not.toContain("log-5"); // financial_operation
  });

  it("resolves the actor to you / the other party / support", () => {
    const events = toDisputeTimeline(rentalDispute(), RENTER);
    expect(events.find((e) => e.id === "log-1")?.actor).toBe("you");
    expect(events.find((e) => e.id === "log-2")?.actor).toBe("other_party");
    expect(events.find((e) => e.id === "log-4")?.actor).toBe("support");
  });

  it("flips you / the other party when the counterparty is the viewer", () => {
    const events = toDisputeTimeline(rentalDispute(), OWNER);
    expect(events.find((e) => e.id === "log-1")?.actor).toBe("other_party");
    expect(events.find((e) => e.id === "log-2")?.actor).toBe("you");
  });

  it("carries the state transition and nothing else from a state change", () => {
    const change = toDisputeTimeline(rentalDispute(), RENTER).find(
      (e) => e.type === "state_change",
    );
    expect(change).toMatchObject({
      previousState: "open",
      newState: "under_review",
    });
    expect(change).not.toHaveProperty("reason");
    expect(change).not.toHaveProperty("details");
    expect(change).not.toHaveProperty("userId");
  });

  it("sorts chronologically even when the DAL order is disturbed", () => {
    const dispute = rentalDispute();
    dispute.auditLogs = [...dispute.auditLogs!].reverse();
    const events = toDisputeTimeline(dispute, RENTER);
    const times = events.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("toParticipantDisputeListItem", () => {
  it("strips the counterparty's email off a list row (F23)", () => {
    const row = toParticipantDisputeListItem(rentalDispute());
    expect(row).not.toHaveProperty("createdByUser");
    expect(row).not.toHaveProperty("resolvedByUser");
    expect(row).not.toHaveProperty("internalNotes");
    expect(JSON.stringify(row)).not.toContain("rita@example.com");
  });

  it("leaves the rest of the row shape intact for the shipped list contracts", () => {
    const row = toParticipantDisputeListItem(rentalDispute());
    expect(row).toMatchObject({
      id: "dispute-1",
      status: "resolved",
      reasonCode: "damage",
      rental: { listing: { name: "Hammer drill" } },
    });
  });

  it("does not mutate the DAL row it was given", () => {
    const dispute = rentalDispute();
    toParticipantDisputeListItem(dispute);
    expect(dispute.createdByUser?.email).toBe("rita@example.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The regression this suite did NOT catch the first time.
//
// Narrowing the payload broke three things on the SHARED web detail page for
// participants — the item name, the "View rental" link, and a "Last Updated"
// line that rendered `formatDateTime(undefined)` — and the full suite stayed
// green, because no test exercises `dispute-details.tsx` against a participant
// payload. A projection being correct in isolation says nothing about whether
// its consumers still have what they read.
//
// This pins the field list instead. It fails when someone narrows further
// without checking who was reading.
describe("the participant payload covers what the web detail page renders", () => {
  // Every `dispute.<field>` access in `dispute-details.tsx` that is not
  // explicitly admin-gated. `rental`/`serviceBooking` are deliberately absent —
  // the page reads `subject` for both now — and so are `auditLogs`,
  // `internalNotes`, `createdByUser` and `resolvedByUser`.
  const RENDERED_FIELDS = [
    "createdAt",
    "createdByRole",
    "description",
    "evidence",
    "evidenceDeadline",
    "financialOperations",
    "policyVersion",
    "reasonCode",
    "referenceNumber",
    "resolutionOutcome",
    "resolutionReason",
    "resolvedAt",
    "status",
    "subject",
    "timeline",
    "updatedAt",
  ] as const;

  it.each(RENDERED_FIELDS)("carries %s", (field) => {
    const view = toParticipantDispute(
      rentalDispute(),
      RENTER,
    ) as unknown as Record<string, unknown>;
    expect(field in view).toBe(true);
    expect(view[field]).not.toBeUndefined();
  });

  it("gives the subject enough to link back to the transaction", () => {
    // The page built its "View Rental" href from `dispute.rental.requestId`.
    // If `subject` cannot answer that, the link silently points at the wrong id.
    const rental = toParticipantDispute(rentalDispute(), RENTER).subject;
    expect(rental?.rentalRequestId).toBe("request-1");

    const service = toParticipantDispute(serviceDispute(), RENTER).subject;
    expect(service?.id).toBe("booking-1");
  });
});

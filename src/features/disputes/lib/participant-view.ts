import type {
  DisputeResolutionOutcome,
  DisputeRole,
  DisputeStatus,
  DisputeWithRelations,
  EvidenceType,
  FinancialOperationStatus,
  FinancialOperationType,
} from "@/dal/types";

/**
 * The participant-safe projection of a dispute (P-E13-2).
 *
 * ## Why this exists
 *
 * `GET /api/disputes/[id]` returned `disputeDAL.getById()` **unmodified** to
 * anyone who passed the participation check. That object eager-loads:
 *
 *  - `internalNotes` — admin-only free text;
 *  - `auditLogs` — every action, including `note_created`, `financial_operation`
 *    and `resolution`, each with a free-text `reason` and a `details` jsonb;
 *  - `financialOperations` — `stripeOperationId`, `stripePaymentIntentId`,
 *    `stripeTransferId`, `errorMessage`, `performedBy`;
 *  - `createdByUser.email` and `resolvedByUser.email`.
 *
 * The sibling route `/api/disputes/[id]/audit` is **admin-gated for the same
 * audit rows**, and its docblock says why: *"Audit logs contain sensitive
 * information including financial operations, internal admin notes, system
 * actions… For user-facing activity, see the dispute details page which shows a
 * filtered timeline."* That filtering was a `.filter()` in a React component —
 * the bytes were always on the wire. Requirement 19.2.5 says admin-side internal
 * notes shall not appear in the app, and a released mobile binary cannot be
 * hot-fixed into not having received them.
 *
 * So the narrowing happens **here, server-side**, and the route picks the
 * projection by role. A Zod strip in a client would fix the rendering and leave
 * the leak.
 *
 * ## What survives, and why
 *
 * Everything Requirement 19.2.1 and 19.2.4 need: status, reference number, the
 * curated timeline, evidence, deadlines, the resolution outcome and its
 * financial consequences (`operationType` + `amount` + `status` — enough to say
 * "Refund issued $40.00", not enough to identify a Stripe object).
 */

/** A timeline entry a participant is allowed to see (Req 19.2.1). */
export type DisputeTimelineEventType =
  | "filed"
  | "state_change"
  | "evidence_added"
  | "resolved";

/**
 * Who acted, without naming them.
 *
 * The web timeline renders `userId.slice(0, 8)`, which tells a user nothing and
 * still hands them a fragment of an identifier. A dispute has exactly two
 * participants and everyone else is support, so the useful fact is which of the
 * three it was — and that leaks nothing the viewer does not already know.
 */
export type DisputeActor = "you" | "other_party" | "support";

export interface DisputeTimelineEvent {
  id: string;
  type: DisputeTimelineEventType;
  at: Date;
  actor: DisputeActor;
  /** Only meaningful on `state_change`; null elsewhere. */
  previousState: DisputeStatus | null;
  newState: DisputeStatus | null;
}

export interface ParticipantEvidence {
  id: string;
  evidenceType: EvidenceType;
  content: string;
  uploadedByRole: DisputeRole;
  uploadedByYou: boolean;
  uploadedAt: Date;
}

/**
 * The money a resolution moved — type, amount and whether it landed.
 *
 * No `stripeOperationId` / `stripePaymentIntentId` / `stripeTransferId`: those
 * identify objects in our Stripe account and answer no question a participant
 * has. No `errorMessage` either — a failed transfer's Stripe text is an
 * operational detail, and surfacing it to a user mid-dispute invites them to
 * argue with it. No `performedBy`: that is an admin's user id.
 */
export interface ParticipantFinancialOperation {
  id: string;
  operationType: FinancialOperationType;
  amount: string | null;
  status: FinancialOperationStatus;
  performedAt: Date;
}

/** What the dispute is about, in the shape the client needs to link to it. */
export interface ParticipantDisputeSubject {
  type: "rental" | "service";
  /** `rentals.id` or `service_bookings.id`. */
  id: string;
  /**
   * `rentals.requestId` — the id rental **detail** is addressed by on both
   * clients (`/api/rentals/[id]` resolves either form, but the mobile app keys
   * its cache on the request id). Null for service bookings, which have one id.
   */
  rentalRequestId: string | null;
  /** Listing name (rental) or title (service). Null if the listing is gone. */
  name: string | null;
}

export interface ParticipantDispute {
  id: string;
  referenceNumber: number | null;
  status: DisputeStatus;
  reasonCode: DisputeWithRelations["reasonCode"];
  description: string;
  policyVersion: string;
  createdAt: Date;
  /**
   * Kept because the web detail page renders a "Last Updated" line from it.
   * Dropping it rendered `formatDateTime(undefined)` there for participants —
   * the kind of breakage a green test suite will not show you when no test
   * exercises that component against this payload.
   */
  updatedAt: Date;
  createdByRole: DisputeRole;
  /** Whether the viewer is the filer — replaces shipping `createdByUser`. */
  filedByYou: boolean;
  evidenceDeadline: Date | null;
  additionalEvidenceDeadline: Date | null;
  resolvedAt: Date | null;
  resolutionOutcome: DisputeResolutionOutcome | null;
  /**
   * The resolution explanation. Kept: it is the human answer to "why did this go
   * the way it did", it is already shown to participants on web, and Req 19.2.4
   * asks for the outcome in plain language. It is written for the participants,
   * unlike `disputeAuditLogs.reason`, which is written for the record.
   */
  resolutionReason: string | null;
  subject: ParticipantDisputeSubject | null;
  evidence: ParticipantEvidence[];
  timeline: DisputeTimelineEvent[];
  financialOperations: ParticipantFinancialOperation[];
}

/**
 * Audit action types a participant sees, mapped to timeline event types.
 *
 * Everything absent is dropped on purpose: `note_created` / `note_updated` /
 * `note_deleted` are admin notes by definition, `financial_operation` duplicates
 * `financialOperations` with more detail than it should, and `evidence_deleted`
 * is an admin action on someone's evidence that would read as an accusation
 * without the context only an admin has.
 */
const VISIBLE_ACTIONS = {
  dispute_created: "filed",
  state_change: "state_change",
  evidence_uploaded: "evidence_added",
  resolution: "resolved",
} as const satisfies Partial<
  Record<
    NonNullable<DisputeWithRelations["auditLogs"]>[number]["actionType"],
    DisputeTimelineEventType
  >
>;

/** The two people on a dispute, whichever marketplace it belongs to. */
function participantsOf(dispute: DisputeWithRelations): string[] {
  if (dispute.rental) return [dispute.rental.renterId, dispute.rental.ownerId];
  if (dispute.serviceBooking) {
    return [
      dispute.serviceBooking.requesterId,
      dispute.serviceBooking.providerId,
    ];
  }
  return [];
}

function actorFor(
  userId: string | null,
  viewerId: string,
  participants: string[],
): DisputeActor {
  if (userId === null) return "support";
  if (userId === viewerId) return "you";
  return participants.includes(userId) ? "other_party" : "support";
}

/**
 * What the dispute is about, in one shape for both marketplaces.
 *
 * Exported because the **admin** payload carries it too. The web detail page
 * took the item name and the "View rental / View booking" link off
 * `dispute.rental` / `dispute.serviceBooking`, which participants no longer
 * receive — so both surfaces read `subject` and there is one shape to keep
 * working rather than two.
 */
export function subjectOf(
  dispute: DisputeWithRelations,
): ParticipantDisputeSubject | null {
  if (dispute.rental) {
    return {
      type: "rental",
      id: dispute.rental.id,
      rentalRequestId: dispute.rental.requestId ?? null,
      name: dispute.rental.listing?.name ?? null,
    };
  }
  if (dispute.serviceBooking) {
    return {
      type: "service",
      id: dispute.serviceBooking.id,
      rentalRequestId: null,
      name: dispute.serviceBooking.listing?.title ?? null,
    };
  }
  return null;
}

/**
 * Build the curated, participant-visible timeline (Req 19.2.1).
 *
 * Note what does *not* come along: `details` (an untyped jsonb written for
 * admins), `reason` (admin free text), and `userId` (resolved to an actor role
 * instead).
 */
export function toDisputeTimeline(
  dispute: DisputeWithRelations,
  viewerId: string,
): DisputeTimelineEvent[] {
  const participants = participantsOf(dispute);

  return (dispute.auditLogs ?? [])
    .filter((log) => log.actionType in VISIBLE_ACTIONS)
    .map((log) => ({
      id: log.id,
      type: VISIBLE_ACTIONS[log.actionType as keyof typeof VISIBLE_ACTIONS],
      at: log.createdAt,
      actor: actorFor(log.userId, viewerId, participants),
      previousState: log.previousState,
      newState: log.newState,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Project a dispute for one of its participants.
 *
 * @param dispute - the full DAL row
 * @param viewerId - the authenticated participant; only used to resolve
 *   "you" vs "the other party", never to widen what is returned
 */
export function toParticipantDispute(
  dispute: DisputeWithRelations,
  viewerId: string,
): ParticipantDispute {
  return {
    id: dispute.id,
    referenceNumber: dispute.referenceNumber,
    status: dispute.status,
    reasonCode: dispute.reasonCode,
    description: dispute.description,
    policyVersion: dispute.policyVersion,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    createdByRole: dispute.createdByRole,
    filedByYou: dispute.createdBy === viewerId,
    evidenceDeadline: dispute.evidenceDeadline,
    additionalEvidenceDeadline: dispute.additionalEvidenceDeadline,
    resolvedAt: dispute.resolvedAt,
    resolutionOutcome: dispute.resolutionOutcome,
    resolutionReason: dispute.resolutionReason,
    subject: subjectOf(dispute),
    evidence: (dispute.evidence ?? []).map((item) => ({
      id: item.id,
      evidenceType: item.evidenceType,
      content: item.content,
      uploadedByRole: item.uploadedByRole,
      uploadedByYou: item.uploadedBy === viewerId,
      uploadedAt: item.uploadedAt,
    })),
    timeline: toDisputeTimeline(dispute, viewerId),
    financialOperations: (dispute.financialOperations ?? []).map((op) => ({
      id: op.id,
      operationType: op.operationType,
      amount: op.amount,
      status: op.status,
      performedAt: op.performedAt,
    })),
  };
}

/**
 * Strip `createdByUser` from a **list** row.
 *
 * `getUserDisputes` joins `createdByUser` including `email`, so a dispute the
 * counterparty filed hands the viewer their email address (F23). Nothing renders
 * it on either client. The rest of the list row — status, reason, dates, and the
 * rental/service-booking stub with its listing name — is kept as-is so the
 * shipped list contracts keep parsing; this is a removal, not a reshape.
 */
const LIST_OMITTED = [
  "createdByUser",
  "resolvedByUser",
  "internalNotes",
] as const satisfies readonly (keyof DisputeWithRelations)[];

export function toParticipantDisputeListItem<T extends DisputeWithRelations>(
  dispute: T,
): Omit<T, (typeof LIST_OMITTED)[number]> {
  const copy = { ...dispute };
  for (const key of LIST_OMITTED) delete copy[key];
  return copy;
}

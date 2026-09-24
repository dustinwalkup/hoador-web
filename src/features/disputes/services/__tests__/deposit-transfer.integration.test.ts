import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

/**
 * BIZ-04 against a REAL Postgres: resolving a damage dispute for the owner
 * captures the renter's deposit and pays the full captured amount on to the
 * owner. Stripe is mocked; every database statement is real, including the
 * `transfer_deposit` value migration 0074 added to `financial_operation_type`.
 */

const mockCapture = vi.fn();
const mockTransfersCreate = vi.fn();
vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: { capture: (...a: unknown[]) => mockCapture(...a) },
    transfers: { create: (...a: unknown[]) => mockTransfersCreate(...a) },
  },
}));

const mockAssertConnectReady = vi.fn();
vi.mock("@/features/payments/lib/assert-connect-ready", () => ({
  assertConnectReady: (...a: unknown[]) => mockAssertConnectReady(...a),
}));

vi.mock("@/features/disputes/notifications/dispute-notifications", () => ({
  sendDisputeNotifications: vi.fn(),
}));
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn(async () => {}),
}));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { DisputeResolutionService } from "../dispute-resolution-service";
import {
  createUser,
  createListing,
  createRentalRequest,
  daysFromToday,
} from "@/test/integration/factories";

const {
  user,
  rentals,
  rentalPaymentLifecycle,
  disputes,
  disputeFinancialOperations,
} = schema;

/** A returned rental with a held $150 deposit and an open damage dispute. */
async function disputedRental(ownerAccount: string | null = "acct_owner") {
  const owner = await createUser();
  await db
    .update(user)
    .set({ stripeConnectedAccountId: ownerAccount })
    .where(eq(user.id, owner.id));
  const renter = await createUser();
  const admin = await createUser();
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: "completed",
    paymentStatus: "succeeded",
    startDate: daysFromToday(-5),
    endDate: daysFromToday(-2),
    securityDeposit: "150.00",
  });
  const [rental] = await db
    .insert(rentals)
    .values({
      requestId: request.id,
      listingId: listing.id,
      renterId: renter.id,
      ownerId: owner.id,
      startDate: request.startDate,
      endDate: request.endDate,
      totalAmount: request.totalAmount,
      securityDeposit: "150.00",
      securityDepositAuthId: "pi_dep_integration",
    })
    .returning();
  await db.insert(rentalPaymentLifecycle).values({
    rentalId: rental.id,
    rentalChargeId: "ch_rental_integration",
    depositHoldStatus: "held",
  });
  const [dispute] = await db
    .insert(disputes)
    .values({
      rentalId: rental.id,
      createdBy: owner.id,
      createdByRole: "owner",
      reasonCode: "damage",
      description: "Returned with a cracked housing",
      policyVersion: "1",
    })
    .returning();
  return { owner, admin, rental, dispute };
}

const operations = (disputeId: string) =>
  db
    .select()
    .from(disputeFinancialOperations)
    .where(eq(disputeFinancialOperations.disputeId, disputeId));

describe("captured deposit paid to the owner (BIZ-04, real DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCapture.mockImplementation(
      async (_id: string, params: { amount_to_capture?: number }) => ({
        id: "pi_dep_integration",
        amount_received: params.amount_to_capture ?? 15000,
        latest_charge: "ch_dep_integration",
      }),
    );
    mockTransfersCreate.mockResolvedValue({ id: "tr_dep_integration" });
    mockAssertConnectReady.mockResolvedValue(undefined);
  });

  it("transfers the whole captured deposit and records it", async () => {
    const { admin, dispute } = await disputedRental();

    const result = await DisputeResolutionService.resolveDispute({
      disputeId: dispute.id,
      outcome: "favor_provider",
      reason: "Damage shown in the return photos",
      adminId: admin.id,
    });

    expect(result.depositOperationStatus).toBe("captured");
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15000,
        destination: "acct_owner",
        source_transaction: "ch_dep_integration",
      }),
      { idempotencyKey: `deposit-transfer-${dispute.id}` },
    );
    const transfer = (await operations(dispute.id)).find(
      (op) => op.operationType === "transfer_deposit",
    );
    expect(transfer).toMatchObject({
      status: "succeeded",
      amount: "150.00",
      stripeTransferId: "tr_dep_integration",
    });
  });

  it("transfers only the partial amount captured", async () => {
    const { admin, dispute } = await disputedRental();

    await DisputeResolutionService.resolveDispute({
      disputeId: dispute.id,
      outcome: "partial_provider",
      reason: "Minor damage",
      adminId: admin.id,
      partialAmount: 40,
    });

    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000 }),
      expect.anything(),
    );
  });

  it("resolves anyway, and records a failed transfer, when the owner has no Connect account", async () => {
    const { admin, dispute } = await disputedRental(null);

    const result = await DisputeResolutionService.resolveDispute({
      disputeId: dispute.id,
      outcome: "favor_provider",
      reason: "Damage shown in the return photos",
      adminId: admin.id,
    });

    expect(result.dispute.status).toBe("resolved");
    expect(mockTransfersCreate).not.toHaveBeenCalled();
    const transfer = (await operations(dispute.id)).find(
      (op) => op.operationType === "transfer_deposit",
    );
    expect(transfer).toMatchObject({ status: "failed", amount: "150.00" });
    expect(sendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({ event: "deposit_transfer_failed" }),
    );
  });
});

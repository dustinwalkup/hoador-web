import { eq, and, or, ne, sql, desc, asc, gte, isNotNull } from "drizzle-orm";
import { BaseDAL } from "./base";
import { NotFoundError, ValidationError } from "./errors";
import {
  type PaginatedResult,
  type DisputeStatus,
  type DisputeReasonCode,
  type DisputeRole,
  type DisputeResolutionOutcome,
  type EvidenceType,
  type AuditActionType,
  type FinancialOperationType,
  type FinancialOperationStatus,
  type CreateDisputeData,
  type DisputeWithRelations,
  type GetUserDisputesOptions,
  type GetAdminDisputesOptions,
  type RateLimitResult,
  type TimeWindowValidationResult,
  type EvidenceDeadlineResult,
} from "./types";
import {
  disputes,
  disputeEvidence,
  disputeAuditLogs,
  disputeInternalNotes,
  disputeFinancialOperations,
} from "@/db/schemas/disputes.schema";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";

export class DisputeDAL extends BaseDAL {
  /**
   * Create a new dispute
   * @param data - Dispute creation data including rentalId, createdBy, createdByRole, reasonCode, description, and policyVersion
   * @returns The created dispute with all relations loaded
   * @throws {ValidationError} If validation fails
   * @throws {DatabaseError} If database operation fails
   */
  async create(data: CreateDisputeData): Promise<DisputeWithRelations> {
    try {
      // Calculate evidence deadline if not provided (7 days from now)
      const evidenceDeadline =
        data.evidenceDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [dispute] = await this.db
        .insert(disputes)
        .values({
          rentalId: data.rentalId,
          createdBy: data.createdBy,
          createdByRole: data.createdByRole,
          reasonCode: data.reasonCode,
          description: data.description,
          policyVersion: data.policyVersion,
          evidenceDeadline,
          status: "open",
        })
        .returning();

      // Fetch with relations
      return (await this.getById(dispute.id)) as DisputeWithRelations;
    } catch (error) {
      this.handleError(error, "create");
    }
  }

  /**
   * Get dispute by ID with all relations
   * @param id - Dispute UUID
   * @returns The dispute with all relations (rental, users, evidence, audit logs, notes, financial operations) or null if not found
   */
  async getById(id: string): Promise<DisputeWithRelations | null> {
    try {
      const dispute = await this.db.query.disputes.findFirst({
        where: eq(disputes.id, id),
        with: {
          rental: {
            columns: {
              id: true,
              requestId: true,
              listingId: true,
              renterId: true,
              ownerId: true,
            },
            with: {
              listing: {
                columns: {
                  name: true,
                },
              },
            },
          },
          createdByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          resolvedByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          evidence: {
            orderBy: [asc(disputeEvidence.uploadedAt)],
          },
          auditLogs: {
            orderBy: [asc(disputeAuditLogs.createdAt)],
          },
          internalNotes: {
            orderBy: [desc(disputeInternalNotes.createdAt)],
          },
          financialOperations: {
            orderBy: [desc(disputeFinancialOperations.performedAt)],
          },
        },
      });

      if (!dispute) {
        return null;
      }

      // Map auditLogs to ensure details field is properly typed
      const mappedDispute: DisputeWithRelations = {
        ...dispute,
        auditLogs: dispute.auditLogs?.map((log) => ({
          ...log,
          details:
            log.details && typeof log.details === "object"
              ? (log.details as Record<string, unknown>)
              : null,
        })),
      };

      return mappedDispute;
    } catch (error) {
      this.handleError(error, "getById");
    }
  }

  /**
   * Get active dispute by rental ID
   * Returns dispute if it exists and status is not 'closed'
   * @param rentalId - Rental UUID
   * @returns The active dispute with basic relations or null if no active dispute exists
   */
  async getActiveByRentalId(
    rentalId: string,
  ): Promise<DisputeWithRelations | null> {
    try {
      const dispute = await this.db.query.disputes.findFirst({
        where: and(
          eq(disputes.rentalId, rentalId),
          ne(disputes.status, "closed"),
        ),
        with: {
          rental: {
            columns: {
              id: true,
              requestId: true,
              listingId: true,
              renterId: true,
              ownerId: true,
            },
            with: {
              listing: {
                columns: {
                  name: true,
                },
              },
            },
          },
          createdByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return dispute as DisputeWithRelations | null;
    } catch (error) {
      this.handleError(error, "getActiveByRentalId");
    }
  }

  /**
   * Get user disputes with pagination
   * Filters by user role (renter or provider) based on rental relationship
   * @param userId - User ID to filter disputes for
   * @param options - Query options including role filter, status filter, page, and limit
   * @returns Paginated result with disputes where user is either renter or provider
   */
  async getUserDisputes(
    userId: string,
    options: GetUserDisputesOptions = {},
  ): Promise<PaginatedResult<DisputeWithRelations>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 12;
      this.validatePagination(page, limit);

      // Build where conditions
      const conditions = [];

      // Filter by role - user must be either renter or provider of the rental
      if (options.role === "renter") {
        // User is renter - join with rentals to find disputes where rental.renterId = userId
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${rentals} r
            WHERE r.id = ${disputes.rentalId} AND r.renter_id = ${userId}
          )`,
        );
      } else if (options.role === "provider") {
        // User is provider - join with rentals to find disputes where rental.ownerId = userId
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${rentals} r
            WHERE r.id = ${disputes.rentalId} AND r.owner_id = ${userId}
          )`,
        );
      } else {
        // No role filter - user is either renter or provider
        conditions.push(
          or(
            sql`EXISTS (
              SELECT 1 FROM ${rentals} r
              WHERE r.id = ${disputes.rentalId} AND r.renter_id = ${userId}
            )`,
            sql`EXISTS (
              SELECT 1 FROM ${rentals} r
              WHERE r.id = ${disputes.rentalId} AND r.owner_id = ${userId}
            )`,
          ),
        );
      }

      // Filter by status
      if (options.status) {
        conditions.push(eq(disputes.status, options.status));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      // Get paginated disputes
      const disputesList = await this.db.query.disputes.findMany({
        where: whereClause,
        with: {
          rental: {
            columns: {
              id: true,
              requestId: true,
              listingId: true,
              renterId: true,
              ownerId: true,
            },
            with: {
              listing: {
                columns: {
                  name: true,
                },
              },
            },
          },
          createdByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          evidence: {
            columns: {
              id: true,
            },
          },
        },
        orderBy: [desc(disputes.createdAt)],
        limit,
        offset: (page - 1) * limit,
      });

      return this.createPaginatedResult(
        disputesList as DisputeWithRelations[],
        total,
        page,
        limit,
      );
    } catch (error) {
      this.handleError(error, "getUserDisputes");
    }
  }

  /**
   * Get admin disputes with filters and pagination
   * @param options - Query options including status filter, reasonCode filter, page, and limit
   * @returns Paginated result with all disputes matching filters
   */
  async getAdminDisputes(
    options: GetAdminDisputesOptions = {},
  ): Promise<PaginatedResult<DisputeWithRelations>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 12;
      this.validatePagination(page, limit);

      // Build where conditions
      const conditions = [];

      if (options.status) {
        conditions.push(eq(disputes.status, options.status));
      }

      if (options.reasonCode) {
        conditions.push(eq(disputes.reasonCode, options.reasonCode));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      // Get paginated disputes with relations
      const disputesList = await this.db.query.disputes.findMany({
        where: whereClause,
        with: {
          rental: {
            columns: {
              id: true,
              requestId: true,
              listingId: true,
              renterId: true,
              ownerId: true,
            },
            with: {
              listing: {
                columns: {
                  name: true,
                },
              },
            },
          },
          createdByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          resolvedByUser: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          evidence: {
            columns: {
              id: true,
            },
          },
          auditLogs: {
            columns: {
              id: true,
            },
          },
          internalNotes: {
            columns: {
              id: true,
            },
          },
          financialOperations: {
            columns: {
              id: true,
            },
          },
        },
        orderBy: [desc(disputes.createdAt)],
        limit,
        offset: (page - 1) * limit,
      });

      return this.createPaginatedResult(
        disputesList as DisputeWithRelations[],
        total,
        page,
        limit,
      );
    } catch (error) {
      this.handleError(error, "getAdminDisputes");
    }
  }

  /**
   * Count disputes that need admin review
   * Pending disputes = those in 'open', 'evidence_requested', or 'under_review' states
   * @returns Count of pending disputes
   */
  async countPendingDisputes(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(
          or(
            eq(disputes.status, "open"),
            eq(disputes.status, "evidence_requested"),
            eq(disputes.status, "under_review"),
          ),
        );

      return Number(result[0]?.count || 0);
    } catch (error) {
      this.handleError(error, "countPendingDisputes");
    }
  }

  /**
   * Get comprehensive dispute statistics for admin dashboard
   * @returns Object with various dispute statistics
   */
  async getDisputeStats(): Promise<{
    total: number;
    pending: number;
    resolvedThisMonth: number;
    byStatus: Record<DisputeStatus, number>;
    byReasonCode: Record<DisputeReasonCode, number>;
    averageResolutionTime: number | null; // in days
  }> {
    try {
      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes);
      const total = Number(totalResult[0]?.count || 0);

      // Get pending count
      const pending = await this.countPendingDisputes();

      // Get resolved this month count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const resolvedThisMonthResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(
          and(
            eq(disputes.status, "resolved"),
            isNotNull(disputes.resolvedAt),
            gte(disputes.resolvedAt, startOfMonth),
          ),
        );
      const resolvedThisMonth = Number(resolvedThisMonthResult[0]?.count || 0);

      // Get breakdown by status
      const statusBreakdownResult = await this.db
        .select({
          status: disputes.status,
          count: sql<number>`count(*)`,
        })
        .from(disputes)
        .groupBy(disputes.status);

      const byStatus: Record<DisputeStatus, number> = {
        open: 0,
        evidence_requested: 0,
        under_review: 0,
        resolved: 0,
        closed: 0,
      };

      for (const row of statusBreakdownResult) {
        byStatus[row.status] = Number(row.count || 0);
      }

      // Get breakdown by reason code
      const reasonCodeBreakdownResult = await this.db
        .select({
          reasonCode: disputes.reasonCode,
          count: sql<number>`count(*)`,
        })
        .from(disputes)
        .groupBy(disputes.reasonCode);

      const byReasonCode: Record<DisputeReasonCode, number> = {
        damage: 0,
        non_delivery: 0,
        quality_issue: 0,
        cancellation: 0,
        payment_issue: 0,
        renter_no_show: 0,
        owner_no_show: 0,
        other: 0,
      };

      for (const row of reasonCodeBreakdownResult) {
        byReasonCode[row.reasonCode] = Number(row.count || 0);
      }

      // Calculate average resolution time (in days) for resolved disputes
      const resolutionTimeResult = await this.db
        .select({
          avgDays: sql<number>`AVG(EXTRACT(EPOCH FROM (${disputes.resolvedAt} - ${disputes.createdAt})) / 86400)`,
        })
        .from(disputes)
        .where(
          and(eq(disputes.status, "resolved"), isNotNull(disputes.resolvedAt)),
        );

      const averageResolutionTime =
        resolutionTimeResult[0]?.avgDays !== null
          ? Math.round(Number(resolutionTimeResult[0]?.avgDays || 0) * 10) / 10
          : null;

      return {
        total,
        pending,
        resolvedThisMonth,
        byStatus,
        byReasonCode,
        averageResolutionTime,
      };
    } catch (error) {
      this.handleError(error, "getDisputeStats");
    }
  }

  /**
   * Update dispute state
   * Note: State transition validation happens in service layer
   * @param id - Dispute UUID
   * @param newState - New dispute status
   * @param _userId - User ID who initiated the change (for audit purposes, currently unused)
   * @param _reason - Reason for state change (for audit purposes, currently unused)
   * @returns Updated dispute with all relations
   * @throws {NotFoundError} If dispute not found
   */
  async updateState(
    id: string,
    newState: DisputeStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reason?: string,
  ): Promise<DisputeWithRelations> {
    try {
      const [updated] = await this.db
        .update(disputes)
        .set({
          status: newState,
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("Dispute", id);
      }

      // Fetch with relations
      return (await this.getById(updated.id)) as DisputeWithRelations;
    } catch (error) {
      this.handleError(error, "updateState");
    }
  }

  /**
   * Resolve a dispute
   * @param id - Dispute UUID
   * @param outcome - Resolution outcome (favor_renter, favor_provider, partial_renter, partial_provider, dismissed)
   * @param reason - Resolution reason (max 1000 characters)
   * @param resolvedBy - User ID of admin who resolved the dispute
   * @returns Resolved dispute with all relations
   * @throws {ValidationError} If reason exceeds 1000 characters
   * @throws {NotFoundError} If dispute not found
   */
  async resolve(
    id: string,
    outcome: DisputeResolutionOutcome,
    reason: string,
    resolvedBy: string,
  ): Promise<DisputeWithRelations> {
    try {
      // Validate reason length (max 1000 chars)
      if (reason.length > 1000) {
        throw new ValidationError(
          "Resolution reason must be 1000 characters or less",
        );
      }

      const [resolved] = await this.db
        .update(disputes)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy,
          resolutionOutcome: outcome,
          resolutionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, id))
        .returning();

      if (!resolved) {
        throw new NotFoundError("Dispute", id);
      }

      // Fetch with relations
      return (await this.getById(resolved.id)) as DisputeWithRelations;
    } catch (error) {
      this.handleError(error, "resolve");
    }
  }

  /**
   * Link a Stripe chargeback to an internal dispute.
   *
   * @param disputeId - Internal dispute UUID
   * @param stripeChargebackId - Stripe dispute ID (e.g. dp_xxx)
   */
  async updateStripeChargebackId(
    disputeId: string,
    stripeChargebackId: string,
  ): Promise<void> {
    try {
      const [updated] = await this.db
        .update(disputes)
        .set({
          stripeChargebackId,
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId))
        .returning();

      if (!updated) {
        throw new NotFoundError("Dispute", disputeId);
      }
    } catch (error) {
      this.handleError(error, "updateStripeChargebackId");
    }
  }

  /**
   * Check rate limits for dispute creation (on-the-fly calculation)
   * Returns monthly and yearly counts, and whether user is within limits
   * Limits: 3 disputes per month, 10 disputes per year
   * @param userId - User ID to check rate limits for
   * @returns Rate limit result with monthlyCount, yearlyCount, and withinLimits flag
   */
  async checkRateLimits(userId: string): Promise<RateLimitResult> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Count disputes created this month
      const monthlyResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(
          and(
            eq(disputes.createdBy, userId),
            gte(disputes.createdAt, startOfMonth),
          ),
        );

      const monthlyCount = Number(monthlyResult[0]?.count || 0);

      // Count disputes created this year
      const yearlyResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(
          and(
            eq(disputes.createdBy, userId),
            gte(disputes.createdAt, startOfYear),
          ),
        );

      const yearlyCount = Number(yearlyResult[0]?.count || 0);

      // Limits: 3 per month, 10 per year
      const withinLimits = monthlyCount < 3 && yearlyCount < 10;

      return {
        monthlyCount,
        yearlyCount,
        withinLimits,
      };
    } catch (error) {
      this.handleError(error, "checkRateLimits");
    }
  }

  /**
   * Validate unified filing window for Phase 3 dispute creation.
   * Rules:
   *  - If `returnConfirmedAt` is set: `now <= returnConfirmedAt + 24h`
   *  - If `returnConfirmedAt` is NOT set: `now >= startDate`
   * Applies the same 24-hour rule for ALL dispute reason codes.
   *
   * @param rentalId - Rental UUID to validate filing window for
   * @returns Validation result with valid flag and optional error message
   */
  async validateFilingWindowUnified(
    rentalId: string,
  ): Promise<TimeWindowValidationResult> {
    try {
      const rental = await this.db.query.rentals.findFirst({
        where: eq(rentals.id, rentalId),
        columns: {
          id: true,
          startDate: true,
          returnConfirmedAt: true,
        },
      });

      if (!rental) {
        return { valid: false, message: "Rental not found" };
      }

      const now = new Date();

      if (rental.returnConfirmedAt) {
        const deadline = new Date(
          rental.returnConfirmedAt.getTime() + 24 * 60 * 60 * 1000,
        );
        const valid = now <= deadline;
        return {
          valid,
          message: valid
            ? undefined
            : "The dispute filing window closed 24 hours after the return was confirmed",
        };
      }

      const valid = now >= rental.startDate;
      return {
        valid,
        message: valid
          ? undefined
          : "Disputes cannot be filed before the rental start date",
      };
    } catch (error) {
      this.handleError(error, "validateFilingWindowUnified");
    }
  }

  /**
   * @deprecated Use `validateFilingWindowUnified` for Phase 3 unified 24-hour window.
   * Validate time window for dispute creation based on reason code.
   * Time windows vary by reason code (e.g., 7 days for damage, 3 days for non_delivery)
   * @param rentalId - Rental UUID to validate time window for
   * @param reasonCode - Dispute reason code that determines the time window
   * @returns Validation result with valid flag and optional error message
   */
  async validateTimeWindow(
    rentalId: string,
    reasonCode: DisputeReasonCode,
  ): Promise<TimeWindowValidationResult> {
    try {
      // Get rental with dates
      const rental = await this.db.query.rentals.findFirst({
        where: eq(rentals.id, rentalId),
        columns: {
          id: true,
          startDate: true,
          endDate: true,
        },
      });

      if (!rental) {
        // Try rental_requests table
        const rentalRequest = await this.db.query.rentalRequests.findFirst({
          where: eq(rentalRequests.id, rentalId),
          columns: {
            id: true,
            startDate: true,
            endDate: true,
          },
        });

        if (!rentalRequest) {
          return {
            valid: false,
            message: "Rental not found",
          };
        }

        return this.calculateTimeWindow(
          rentalRequest.startDate,
          rentalRequest.endDate,
          reasonCode,
        );
      }

      return this.calculateTimeWindow(
        rental.startDate,
        rental.endDate,
        reasonCode,
      );
    } catch (error) {
      this.handleError(error, "validateTimeWindow");
    }
  }

  /**
   * Calculate time window based on reason code
   */
  private calculateTimeWindow(
    startDate: Date,
    endDate: Date,
    reasonCode: DisputeReasonCode,
  ): TimeWindowValidationResult {
    const now = new Date();
    let deadline: Date;

    switch (reasonCode) {
      case "damage":
        // 7 days after endDate
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + 7);
        break;
      case "non_delivery":
        // 3 days after startDate
        deadline = new Date(startDate);
        deadline.setDate(deadline.getDate() + 3);
        break;
      case "quality_issue":
        // 7 days after endDate
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + 7);
        break;
      case "cancellation":
        // 2 days after cancellation (if applicable)
        // For now, use 2 days after startDate as fallback
        deadline = new Date(startDate);
        deadline.setDate(deadline.getDate() + 2);
        break;
      case "payment_issue":
        // 30 days after payment (use endDate as proxy)
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + 30);
        break;
      case "other":
        // 14 days after endDate
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + 14);
        break;
      default:
        return {
          valid: false,
          message: "Invalid reason code",
        };
    }

    const valid = now <= deadline;

    return {
      valid,
      message: valid
        ? undefined
        : `Time window expired. Deadline was ${deadline.toISOString()}`,
    };
  }

  /**
   * Create evidence record
   * @param data - Evidence data including disputeId, uploadedBy, uploadedByRole, evidenceType, and content
   * @returns Created evidence record
   */
  async createEvidence(data: {
    disputeId: string;
    uploadedBy: string;
    uploadedByRole: DisputeRole;
    evidenceType: EvidenceType;
    content: string;
  }): Promise<typeof disputeEvidence.$inferSelect> {
    try {
      const [evidence] = await this.db
        .insert(disputeEvidence)
        .values({
          disputeId: data.disputeId,
          uploadedBy: data.uploadedBy,
          uploadedByRole: data.uploadedByRole,
          evidenceType: data.evidenceType,
          content: data.content,
        })
        .returning();

      return evidence;
    } catch (error) {
      this.handleError(error, "createEvidence");
    }
  }

  /**
   * Get evidence by dispute ID
   * @param disputeId - Dispute UUID
   * @returns Array of evidence records ordered by upload date (oldest first)
   */
  async getEvidenceByDisputeId(
    disputeId: string,
  ): Promise<Array<typeof disputeEvidence.$inferSelect>> {
    try {
      return await this.db.query.disputeEvidence.findMany({
        where: eq(disputeEvidence.disputeId, disputeId),
        orderBy: [asc(disputeEvidence.uploadedAt)],
      });
    } catch (error) {
      this.handleError(error, "getEvidenceByDisputeId");
    }
  }

  /**
   * Check evidence deadline for a dispute
   * Determines which deadline to check based on dispute status
   * @param disputeId - Dispute UUID
   * @returns Deadline result with expired flag, deadline date, and time remaining in milliseconds
   * @throws {NotFoundError} If dispute not found
   */
  async checkEvidenceDeadline(
    disputeId: string,
  ): Promise<EvidenceDeadlineResult> {
    try {
      const dispute = await this.db.query.disputes.findFirst({
        where: eq(disputes.id, disputeId),
        columns: {
          id: true,
          status: true,
          evidenceDeadline: true,
          additionalEvidenceDeadline: true,
        },
      });

      if (!dispute) {
        throw new NotFoundError("Dispute", disputeId);
      }

      // Determine which deadline to check based on status
      let deadline: Date | null = null;

      if (dispute.status === "evidence_requested") {
        deadline = dispute.evidenceDeadline;
      } else if (dispute.status === "under_review") {
        deadline =
          dispute.additionalEvidenceDeadline || dispute.evidenceDeadline;
      }

      if (!deadline) {
        return {
          expired: false,
          deadline: null,
        };
      }

      const now = new Date();
      const expired = now > deadline;
      const timeRemaining = expired ? 0 : deadline.getTime() - now.getTime();

      return {
        expired,
        deadline,
        timeRemaining,
      };
    } catch (error) {
      this.handleError(error, "checkEvidenceDeadline");
    }
  }

  /**
   * Create audit log entry
   * @param data - Audit log data including disputeId, actionType, userId, previousState, newState, details, and reason
   * @returns Created audit log record
   */
  async createAuditLog(data: {
    disputeId: string;
    actionType: AuditActionType;
    userId?: string;
    previousState?: DisputeStatus;
    newState?: DisputeStatus;
    details?: Record<string, unknown>;
    reason?: string;
  }): Promise<typeof disputeAuditLogs.$inferSelect> {
    try {
      const [auditLog] = await this.db
        .insert(disputeAuditLogs)
        .values({
          disputeId: data.disputeId,
          actionType: data.actionType,
          userId: data.userId || null,
          previousState: data.previousState || null,
          newState: data.newState || null,
          details: data.details || null,
          reason: data.reason || null,
        })
        .returning();

      return auditLog;
    } catch (error) {
      this.handleError(error, "createAuditLog");
    }
  }

  /**
   * Get audit logs by dispute ID
   * @param disputeId - Dispute UUID
   * @returns Array of audit log records ordered by creation date (oldest first)
   */
  async getAuditLogsByDisputeId(
    disputeId: string,
  ): Promise<Array<typeof disputeAuditLogs.$inferSelect>> {
    try {
      return await this.db.query.disputeAuditLogs.findMany({
        where: eq(disputeAuditLogs.disputeId, disputeId),
        orderBy: [asc(disputeAuditLogs.createdAt)],
      });
    } catch (error) {
      this.handleError(error, "getAuditLogsByDisputeId");
    }
  }

  /**
   * Create internal note (admin only)
   * @param data - Note data including disputeId, adminId, and content
   * @returns Created internal note record
   */
  async createInternalNote(data: {
    disputeId: string;
    adminId: string;
    content: string;
  }): Promise<typeof disputeInternalNotes.$inferSelect> {
    try {
      const [note] = await this.db
        .insert(disputeInternalNotes)
        .values({
          disputeId: data.disputeId,
          adminId: data.adminId,
          content: data.content,
        })
        .returning();

      return note;
    } catch (error) {
      this.handleError(error, "createInternalNote");
    }
  }

  /**
   * Get internal notes by dispute ID (newest first)
   * @param disputeId - Dispute UUID
   * @returns Array of internal note records ordered by creation date (newest first)
   */
  async getInternalNotesByDisputeId(
    disputeId: string,
  ): Promise<Array<typeof disputeInternalNotes.$inferSelect>> {
    try {
      return await this.db.query.disputeInternalNotes.findMany({
        where: eq(disputeInternalNotes.disputeId, disputeId),
        orderBy: [desc(disputeInternalNotes.createdAt)],
      });
    } catch (error) {
      this.handleError(error, "getInternalNotesByDisputeId");
    }
  }

  /**
   * Update internal note
   * @param noteId - Internal note UUID
   * @param content - Updated note content
   * @returns Updated internal note record
   * @throws {NotFoundError} If note not found
   */
  async updateInternalNote(
    noteId: string,
    content: string,
  ): Promise<typeof disputeInternalNotes.$inferSelect> {
    try {
      const [updated] = await this.db
        .update(disputeInternalNotes)
        .set({
          content,
          updatedAt: new Date(),
        })
        .where(eq(disputeInternalNotes.id, noteId))
        .returning();

      if (!updated) {
        throw new NotFoundError("Internal note", noteId);
      }

      return updated;
    } catch (error) {
      this.handleError(error, "updateInternalNote");
    }
  }

  /**
   * Delete internal note
   * @param noteId - Internal note UUID
   */
  async deleteInternalNote(noteId: string): Promise<void> {
    try {
      await this.db
        .delete(disputeInternalNotes)
        .where(eq(disputeInternalNotes.id, noteId));
    } catch (error) {
      this.handleError(error, "deleteInternalNote");
    }
  }

  /**
   * Create financial operation record
   * @param data - Financial operation data including disputeId, operationType, amount, Stripe IDs, status, errorMessage, and performedBy
   * @returns Created financial operation record
   */
  async createFinancialOperation(data: {
    disputeId: string;
    operationType: FinancialOperationType;
    amount?: string;
    stripeOperationId?: string;
    stripePaymentIntentId?: string;
    stripeTransferId?: string;
    status?: FinancialOperationStatus;
    errorMessage?: string;
    performedBy: string;
  }): Promise<typeof disputeFinancialOperations.$inferSelect> {
    try {
      const [operation] = await this.db
        .insert(disputeFinancialOperations)
        .values({
          disputeId: data.disputeId,
          operationType: data.operationType,
          amount: data.amount || null,
          stripeOperationId: data.stripeOperationId || null,
          stripePaymentIntentId: data.stripePaymentIntentId || null,
          stripeTransferId: data.stripeTransferId || null,
          status: data.status || "pending",
          errorMessage: data.errorMessage || null,
          performedBy: data.performedBy,
        })
        .returning();

      return operation;
    } catch (error) {
      this.handleError(error, "createFinancialOperation");
    }
  }

  /**
   * Get financial operations by dispute ID
   * @param disputeId - Dispute UUID
   * @returns Array of financial operation records ordered by performance date (newest first)
   */
  async getFinancialOperationsByDisputeId(
    disputeId: string,
  ): Promise<Array<typeof disputeFinancialOperations.$inferSelect>> {
    try {
      return await this.db.query.disputeFinancialOperations.findMany({
        where: eq(disputeFinancialOperations.disputeId, disputeId),
        orderBy: [desc(disputeFinancialOperations.performedAt)],
      });
    } catch (error) {
      this.handleError(error, "getFinancialOperationsByDisputeId");
    }
  }
}

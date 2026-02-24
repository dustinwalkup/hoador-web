import { auditLogs } from "@/db/schemas/audit-logs.schema";
import type { AuditLogRow } from "@/db/schemas/audit-logs.schema";
import { BaseDAL } from "./base";

/**
 * Input for creating an audit log entry. All fields except entityType, entityId,
 * and action are optional (LOG-AUD-002, LOG-AUD-020).
 */
export interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only DAL for audit_logs. No update or delete methods (LOG-RET-003).
 */
export class AuditLogDAL extends BaseDAL {
  /**
   * Inserts one audit log row. Used by rental, payment, dispute, admin, and
   * webhook flows to record business-critical events.
   *
   * @param entry - entityType, entityId, action required; userId, metadata, ipAddress, userAgent optional
   * @returns The inserted row
   */
  async create(entry: CreateAuditLogInput): Promise<AuditLogRow> {
    try {
      const [inserted] = await this.db
        .insert(auditLogs)
        .values({
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId ?? null,
          metadata: entry.metadata ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        })
        .returning();

      if (!inserted) {
        throw new Error("Audit log insert returned no row");
      }

      return inserted;
    } catch (error) {
      this.handleError(error, "create audit log");
    }
  }
}

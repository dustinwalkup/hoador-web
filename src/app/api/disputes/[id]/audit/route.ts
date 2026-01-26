import { NextRequest, NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";

/**
 * GET /api/disputes/[id]/audit
 * Get audit logs for a dispute (admin only)
 *
 * Audit logs contain sensitive information including:
 * - Financial operations
 * - Internal admin notes
 * - System actions
 * - User IDs and technical details
 *
 * For user-facing activity, see the dispute details page which shows
 * a filtered timeline of user-relevant events.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Require admin
    const adminCheck = await requireAdminResponse();
    if (adminCheck) {
      return adminCheck; // Returns 401 or 403
    }

    const { id: disputeId } = await params;

    // Verify dispute exists
    const dispute = await disputeDAL.getById(disputeId);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Get audit logs
    const auditLogs = await disputeDAL.getAuditLogsByDisputeId(disputeId);

    return NextResponse.json(auditLogs);
  } catch (error) {
    return handleApiError(error);
  }
}

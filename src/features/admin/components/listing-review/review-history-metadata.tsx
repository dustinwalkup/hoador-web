import type { ReactNode } from "react";

import { formatDateTimeLocal } from "@/lib/utils/date.utils";

export type ReviewHistoryUserName = {
  firstName?: string | null;
  lastName?: string | null;
};

export interface ReviewHistoryMetadataProps {
  submittedAt: Date | string | null;
  reviewedBy: ReviewHistoryUserName | null;
  reviewedAt: Date | string | null;
  /**
   * Optional wrapper for the "value" portion of each field.
   * Useful when embedding in different card layouts.
   */
  valueWrapper?: (value: ReactNode) => ReactNode;
}

function formatUserName(user: ReviewHistoryUserName): string {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || "—";
}

/**
 * Shared review metadata UI for admin listing review history.
 * Renders "Submitted at", "Reviewed by", and "Reviewed at" in a layout-friendly way.
 *
 * @param submittedAt - When the listing was first submitted (typically `createdAt`).
 * @param reviewedBy - Admin reviewer display name (first/last); omit section when null.
 * @param reviewedAt - When the admin decision was recorded; omit section when null.
 * @param valueWrapper - Optional wrapper for rendered values (e.g. for tests or layout).
 */
export function ReviewHistoryMetadata({
  submittedAt,
  reviewedBy,
  reviewedAt,
  valueWrapper,
}: ReviewHistoryMetadataProps) {
  const wrapValue = (value: ReactNode) =>
    valueWrapper ? valueWrapper(value) : value;

  return (
    <>
      {submittedAt && (
        <div>
          <span className="text-sm font-medium">Submitted</span>
          <div className="text-muted-foreground text-sm">
            {wrapValue(formatDateTimeLocal(submittedAt))}
          </div>
        </div>
      )}

      {reviewedAt && (
        <div>
          <span className="text-sm font-medium">Reviewed</span>
          <div className="text-muted-foreground text-sm">
            {wrapValue(formatDateTimeLocal(reviewedAt))}
          </div>
        </div>
      )}

      {reviewedBy && (
        <div>
          <span className="text-sm font-medium">Admin</span>
          <div className="text-muted-foreground text-sm">
            {wrapValue(formatUserName(reviewedBy))}
          </div>
        </div>
      )}
    </>
  );
}

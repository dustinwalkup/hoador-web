import { AlertCircle } from "lucide-react";

import { formatDateTimeLocal } from "@/lib/utils/date.utils";
import { parseAppendReviewScalar } from "@/lib/utils/parse-append-review-scalar";

interface RevisionsRequestedBannerProps {
  rejectionReason: string | null | undefined;
  resubmitInstruction?: React.ReactNode;
}

export function RevisionsRequestedBanner({
  rejectionReason,
  resubmitInstruction,
}: RevisionsRequestedBannerProps) {
  const { chunks } = parseAppendReviewScalar(rejectionReason);
  const latest = chunks.at(-1);

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Revisions Requested
        </h3>
        {latest && (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium">Reason</span>
            {latest.timestamp && (
              <span className="text-amber-700 dark:text-amber-300">
                {" "}
                ({formatDateTimeLocal(latest.timestamp)})
              </span>
            )}
            : {latest.message}
          </p>
        )}
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {resubmitInstruction ??
            "Please review the feedback above, make the necessary changes, and save to resubmit your listing for approval."}
        </p>
      </div>
    </div>
  );
}

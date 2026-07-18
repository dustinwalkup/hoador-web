import { ImageIcon } from "lucide-react";

/**
 * Shown when editing an **approved** listing, to set expectations before a save.
 *
 * The re-review policy (Req 2.7.1, amended): only **adding** a new photo to an
 * approved listing sends it back to moderation — a new photo is the only image
 * action that can introduce un-moderated content. Removing or reordering
 * existing photos, and editing text/pricing/other fields, do not. Owners have
 * no intuition for this, so the notice states it plainly.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.7 (F33, D-E2-12)
 */
export function ApprovedListingImageReviewNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Adding photos sends this listing back to review
        </h3>
        <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
          Adding a new photo to an approved listing returns it to moderation and
          hides it from the marketplace until it&apos;s re-approved. Removing or
          reordering existing photos, or editing the title, description,
          pricing, or other details, does{" "}
          <span className="font-medium">not</span> affect its approval.
        </p>
      </div>
    </div>
  );
}

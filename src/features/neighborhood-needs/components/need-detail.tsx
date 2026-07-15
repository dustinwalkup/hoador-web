"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ExternalLink,
  Home,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Star,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { BackButton } from "@/components/back-button";
import { formatMMMd, formatDistanceToNow } from "@/lib/utils/date.utils";
import { formatDistanceMiles } from "@/lib/utils/geo.utils";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";
import {
  useCloseNeed,
  useDeleteNeed,
} from "@/features/neighborhood-needs/hooks/use-needs-mutations";
import type { NeedDetail as NeedDetailType } from "@/dal/neighborhood-needs.dal";

interface NeedDetailProps {
  need: NeedDetailType;
  currentUserId: string;
  isAdmin: boolean;
}

export function NeedDetail({ need, currentUserId, isAdmin }: NeedDetailProps) {
  const router = useRouter();
  const isOwner = need.createdByUserId === currentUserId;
  const isClosed = need.status === "closed";
  const isDeleted = !!need.deletedAt;

  const closeNeed = useCloseNeed();
  const deleteNeed = useDeleteNeed();
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const typeLabel = need.type === "rental" ? "Rental" : "Service";
  const typeVariant =
    need.type === "rental"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      : "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800";

  const statusVariant = isClosed
    ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700"
    : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800";

  const dateRange =
    need.neededStartDate && need.neededEndDate
      ? `${formatMMMd(need.neededStartDate)} – ${formatMMMd(need.neededEndDate)}`
      : need.neededStartDate
        ? `From ${formatMMMd(need.neededStartDate)}`
        : need.neededEndDate
          ? `Until ${formatMMMd(need.neededEndDate)}`
          : null;

  const distanceLabel = formatDistanceMiles(need.distanceMiles);
  const hasRating =
    need.requesterReviewCount > 0 && need.requesterRating != null;

  const createListingHref =
    need.type === "rental"
      ? `/dashboard/listings/add?needId=${need.id}&title=${encodeURIComponent(need.title)}&description=${encodeURIComponent(need.description)}${need.categoryId ? `&category=${need.categoryId}` : ""}`
      : `/dashboard/services/listings/create?needId=${need.id}&title=${encodeURIComponent(need.title)}&description=${encodeURIComponent(need.description)}${need.categoryId ? `&category=${need.categoryId}` : ""}`;

  const handleClose = async () => {
    try {
      await closeNeed.mutateAsync(need.id);
      toast.success("Need closed");
      setCloseConfirmOpen(false);
      // This page is server-rendered (need is a prop, not a query), so the
      // mutation's cache invalidation isn't enough — refresh re-runs the server
      // component and re-reads the now-closed need.
      router.refresh();
    } catch {
      toast.error("Failed to close need");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this need? This cannot be undone."))
      return;
    try {
      await deleteNeed.mutateAsync(need.id);
      toast.success("Need deleted");
    } catch {
      toast.error("Failed to delete need");
    }
  };

  return (
    <>
      <BackButton href="/dashboard/needs" />

      <div className="mx-auto max-w-2xl space-y-6">
        {isDeleted && (
          <div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3">
            <p className="text-destructive text-sm">
              This need has been removed.
            </p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className={`border text-xs ${typeVariant}`}
              >
                {typeLabel}
              </Badge>
              <Badge
                variant="secondary"
                className={`border text-xs ${statusVariant}`}
              >
                {isClosed ? (
                  <>
                    <X className="mr-1 h-3 w-3" />
                    Closed
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Open
                  </>
                )}
              </Badge>
              <span className="text-muted-foreground ml-auto text-xs">
                {formatDistanceToNow(need.createdAt, { addSuffix: true })}
              </span>
            </div>
            <CardTitle className="mt-2 text-xl">
              {sanitizeForDisplay(need.title)}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {sanitizeForDisplay(need.description)}
            </p>

            {dateRange && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Needed {dateRange}</span>
              </div>
            )}

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Home className="h-4 w-4 shrink-0" />
                {need.communityName}
              </span>
              {distanceLabel && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {distanceLabel} away
                </span>
              )}
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
                {hasRating
                  ? `${Number(need.requesterRating).toFixed(1)} (${need.requesterReviewCount} ${need.requesterReviewCount === 1 ? "review" : "reviews"})`
                  : "New requester"}
              </span>
            </div>

            <Separator />

            {/* Actions */}
            {!isClosed && !isDeleted && (
              <div className="flex flex-wrap gap-2">
                {!isOwner && (
                  <Button asChild>
                    <Link href={createListingHref}>
                      <Link2 className="mr-1.5 h-4 w-4" />
                      Create Listing
                    </Link>
                  </Button>
                )}

                {(isOwner || isAdmin) && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/needs/${need.id}/edit`}>
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Edit
                      </Link>
                    </Button>
                    <AlertDialog
                      open={closeConfirmOpen}
                      onOpenChange={setCloseConfirmOpen}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={closeNeed.isPending}
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          Close
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Close this need?</AlertDialogTitle>
                          <AlertDialogDescription>
                            It&apos;ll be marked as closed and drop off the open
                            needs feed so neighbors no longer see it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={closeNeed.isPending}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              handleClose();
                            }}
                            disabled={closeNeed.isPending}
                          >
                            {closeNeed.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Closing…
                              </>
                            ) : (
                              "Close need"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteNeed.isPending}
                    className="ml-auto"
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}

            {isClosed && (
              <p className="text-muted-foreground text-sm">
                This need is closed
                {need.closeReason === "booking"
                  ? " — fulfilled by a booking"
                  : need.closeReason === "admin"
                    ? " — closed by an admin"
                    : ""}
                .
              </p>
            )}
          </CardContent>
        </Card>

        {/* Linked listings */}
        {need.linkedListings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Linked listings ({need.linkedListings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {need.linkedListings.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {link.title ?? "Listing"}
                    </p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {link.listingType}
                      {link.isLive ? "" : " · pending review"}
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                  >
                    <Link href={link.href} target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

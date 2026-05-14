export const dynamic = "force-dynamic";
import { Star, MapPin, Calendar, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { rentalDAL, blindReviewDAL, communityDAL, userDAL } from "@/dal";
import { PROFILE_OVERVIEW, PROFILE_PAGE_HEADERS } from "@/constants/profile";
import { formatReviewSummary } from "@/features/users/utils/reviews.utils";
import {
  formatMemberSince,
  getUserCity,
  getUserFullName,
  getUserState,
} from "@/features/users/utils/users.utils";
import { ProfileImageSection } from "@/features/users/components/profile-image-section";
import { VisibilitySettingsCard } from "@/features/users/components/visibility-settings-card";
import { PendingVerificationBadge } from "@/features/users/components/pending-verification-badge";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProfileTabs } from "../../../features/users/components/profile/profile-tabs";
import { ProfileForm } from "../../../features/users/components/profile/profile-form";

export const metadata = {
  title: "Profile",
  description: "Manage your profile and account settings",
};

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  if (!userId) return notFound();

  // getCurrentUser/getCurrentUserId resolve through the slim auth lookup
  // (getUserForAuth), which intentionally omits addresses. The profile page
  // renders the user's primary address, so fetch the full profile here.
  const [user, reviews, borrowedCount, sharedCount, primaryMembership] =
    await Promise.all([
      userDAL.getUserById(userId),
      blindReviewDAL.getAggregate(userId),
      rentalDAL.countBorrowedListings(userId),
      rentalDAL.countSharedListings(userId),
      communityDAL.getPrimaryMembershipForUser(userId),
    ]);

  const verificationPending =
    primaryMembership?.membership.verificationStatus === "pending";

  return (
    <div className="container pb-6">
      <PageHeader
        title={PROFILE_PAGE_HEADERS.profile.title}
        description={PROFILE_PAGE_HEADERS.profile.description}
      />

      <ProfileTabs>
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="lg:col-span-1">
              <CardHeader className="relative">
                <CardTitle>{PROFILE_OVERVIEW.profileCard.title}</CardTitle>
                <CardDescription>
                  {PROFILE_OVERVIEW.profileCard.description}
                </CardDescription>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-0 right-2 flex h-12 w-12 items-center justify-center">
                        <Info className="text-muted-foreground hover:text-foreground h-5 w-5 cursor-help transition-colors" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs border border-gray-700 bg-gray-900 text-center text-white"
                    >
                      <p>Click on your profile photo to upload a new image</p>
                      <p className="text-xs opacity-90">
                        JPEG, PNG, WebP • Max 5MB
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ProfileImageSection user={user} />

                <div className="mb-2 flex flex-col items-center gap-2">
                  <h3 className="text-xl font-semibold">
                    {getUserFullName(user)}
                  </h3>
                  {verificationPending && <PendingVerificationBadge />}
                </div>

                <div className="text-muted-foreground mb-4 flex items-center text-sm">
                  <MapPin className="mr-1 h-4 w-4" />
                  <span>
                    {getUserCity(user.primaryAddress)},{" "}
                    {getUserState(user.primaryAddress)}
                  </span>
                </div>

                <div className="mb-4 flex items-center">
                  {reviews.totalReviews > 0 && (
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star <= Math.round(reviews.averageRating) ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  )}
                  <span className="ml-2 text-sm">
                    {" "}
                    {formatReviewSummary(
                      reviews.averageRating,
                      reviews.totalReviews,
                    )}
                  </span>
                </div>

                <div className="text-muted-foreground mb-4 text-center text-sm">
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    <span>{formatMemberSince(user.createdAt)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid w-full grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{borrowedCount}</div>
                    <div className="text-muted-foreground text-xs">
                      {PROFILE_OVERVIEW.profileCard.stats.borrowed.label}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{sharedCount}</div>
                    <div className="text-muted-foreground text-xs">
                      {PROFILE_OVERVIEW.profileCard.stats.shared.label}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <ProfileForm user={user} />
          </div>

          <VisibilitySettingsCard />
        </div>
      </ProfileTabs>
    </div>
  );
}

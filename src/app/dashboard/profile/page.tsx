export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { rentalDAL, blindReviewDAL, communityDAL, userDAL } from "@/dal";
import { PROFILE_PAGE_HEADERS } from "@/constants/profile";
import { VisibilitySettingsCard } from "@/features/users/components/visibility-settings-card";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs } from "../../../features/users/components/profile/profile-tabs";
import { ProfileForm } from "../../../features/users/components/profile/profile-form";
import { ProfileSummaryCard } from "../../../features/users/components/profile/profile-summary-card";

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
            <ProfileSummaryCard
              initialUser={user}
              reviews={{
                averageRating: reviews.averageRating,
                totalReviews: reviews.totalReviews,
              }}
              borrowedCount={borrowedCount}
              sharedCount={sharedCount}
              verificationPending={verificationPending}
            />
            <ProfileForm user={user} />
          </div>

          <VisibilitySettingsCard />
        </div>
      </ProfileTabs>
    </div>
  );
}

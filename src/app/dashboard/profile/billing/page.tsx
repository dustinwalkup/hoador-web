export const dynamic = "force-dynamic";
import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";
import { ProfileTabs, BillingTab } from "@/features/users/components/profile";

export const metadata = {
  title: "Billing",
  description: "Manage your payment methods and billing information",
};

export default async function BillingPage() {
  const user = await getCurrentUser();
  const isOnboarded = user
    ? await userDAL.isConnectOnboardingComplete(user.id)
    : false;

  return (
    <div className="container pb-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      />

      <ProfileTabs>
        <BillingTab isOnboarded={isOnboarded} />
      </ProfileTabs>
    </div>
  );
}

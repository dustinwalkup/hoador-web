export const dynamic = "force-dynamic";
import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs } from "../_components/profile-tabs";
import { BillingTab } from "../_components/billing-tab";

export const metadata = {
  title: "Billing | Hoador",
  description: "Manage your payment methods and billing information",
};

export default async function BillingPage() {
  return (
    <div className="container py-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      />

      <ProfileTabs>
        <BillingTab />
      </ProfileTabs>
    </div>
  );
}

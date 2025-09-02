import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs } from "../_components/profile-tabs";
import { SecurityTab } from "../_components/security-tab";

export default async function SecurityPage() {
  return (
    <div className="container py-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      />

      <ProfileTabs>
        <SecurityTab />
      </ProfileTabs>
    </div>
  );
}

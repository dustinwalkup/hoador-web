export const dynamic = "force-dynamic";
import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs, SecurityTab } from "@/features/users/components/profile";

export const metadata = {
  title: "Security | Hoador",
  description: "Manage your password and security settings",
};

export default async function SecurityPage() {
  return (
    <div className="container pb-6">
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

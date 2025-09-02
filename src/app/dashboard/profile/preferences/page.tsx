import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs } from "../_components/profile-tabs";
import { PreferencesTab } from "../_components/preferences-tab";

export default async function PreferencesPage() {
  return (
    <div className="container py-6">
      <PageHeader
        title={PROFILE_TABS.title}
        description={PROFILE_TABS.description}
      />

      <ProfileTabs>
        <PreferencesTab />
      </ProfileTabs>
    </div>
  );
}

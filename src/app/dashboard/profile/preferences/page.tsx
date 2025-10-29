export const dynamic = "force-dynamic";
import { PROFILE_TABS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import {
  ProfileTabs,
  PreferencesTab,
} from "@/features/users/components/profile";

export const metadata = {
  title: "Preferences | Hoador",
  description: "Customize your notification and app preferences",
};

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

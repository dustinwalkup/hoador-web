export const dynamic = "force-dynamic";
import { PROFILE_PAGE_HEADERS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import {
  ProfileTabs,
  PreferencesTab,
} from "@/features/users/components/profile";

export const metadata = {
  title: "Preferences",
  description: "Customize your notification and app preferences",
};

export default async function PreferencesPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title={PROFILE_PAGE_HEADERS.preferences.title}
        description={PROFILE_PAGE_HEADERS.preferences.description}
      />

      <ProfileTabs>
        <PreferencesTab />
      </ProfileTabs>
    </div>
  );
}

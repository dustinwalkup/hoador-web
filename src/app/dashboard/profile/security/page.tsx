export const dynamic = "force-dynamic";
import { PROFILE_PAGE_HEADERS } from "@/constants/profile";
import { PageHeader } from "@/components/page-header";
import { ProfileTabs, SecurityTab } from "@/features/users/components/profile";

export const metadata = {
  title: "Security",
  description: "Manage your password and security settings",
};

export default async function SecurityPage() {
  return (
    <div className="container pb-6">
      <PageHeader
        title={PROFILE_PAGE_HEADERS.security.title}
        description={PROFILE_PAGE_HEADERS.security.description}
      />

      <ProfileTabs>
        <SecurityTab />
      </ProfileTabs>
    </div>
  );
}

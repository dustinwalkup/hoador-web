export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { CommunitiesList } from "@/features/admin/components/community-management/communities-list";

export const metadata = {
  title: "Admin - Communities",
  description: "Manage communities and network assignment",
};

export default function AdminCommunitiesPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="Communities"
        description="Create and edit communities, set their location, and assign them to a network."
      />
      <CommunitiesList />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { AdminUsersTabs } from "@/features/admin/components/user-management/admin-users-tabs";

export const metadata = {
  title: "Admin - User Management",
  description: "Manage users and review residency verifications",
};

export default function UserManagementPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="User Management"
        description="View and manage user accounts, and review pending residency verifications. When no filters are applied, recently signed up users are shown."
      />
      <AdminUsersTabs />
    </div>
  );
}

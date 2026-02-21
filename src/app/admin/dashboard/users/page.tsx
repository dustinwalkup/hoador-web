export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { AdminUsersClient } from "@/features/admin/components/user-management/admin-users-client";

export const metadata = {
  title: "Admin - User Management",
  description: "Manage users and their accounts",
};

export default function UserManagementPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="User Management"
        description="View and manage user accounts. When no filters are applied, recently signed up users are shown."
      />
      <AdminUsersClient />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/auth/utils/guards";
import { PageHeader } from "@/components/page-header";
import { AdminUserDetailClient } from "@/features/admin/components/user-management/admin-user-detail-client";

export const metadata = {
  title: "Admin - User Detail",
  description: "View and manage user account",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin");
  }

  const { id: userId } = await params;

  return (
    <div className="page-container">
      <PageHeader
        title="User detail"
        description="View profile, stats, and manage status or role"
      />
      <AdminUserDetailClient userId={userId} />
    </div>
  );
}

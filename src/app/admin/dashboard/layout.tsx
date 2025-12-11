export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ConditionalPadding } from "@/components/conditional-padding";
import { requireAdmin } from "@/features/auth/utils/guards";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require admin authentication
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (error) {
    redirect("/admin");
  }

  return (
    <SidebarProvider>
      <AdminSidebar user={adminUser} variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/20">
          <ConditionalPadding>{children}</ConditionalPadding>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

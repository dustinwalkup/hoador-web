import { redirect } from "next/navigation";
import { AuthenticatedSidebar } from "@/components/authenticated-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ConditionalPadding } from "@/components/conditional-padding";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeaderProvider } from "@/contexts/page-header-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dashboard always requires authentication
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <SidebarProvider>
      <AuthenticatedSidebar user={user} variant="inset" />
      <SidebarInset>
        <PageHeaderProvider>
          <SiteHeader />
          <div className="bg-muted/20">
            <ConditionalPadding>{children}</ConditionalPadding>
          </div>
        </PageHeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { redirect } from "next/navigation";
import { AuthenticatedSidebar } from "@/components/authenticated-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ConditionalPadding } from "@/components/conditional-padding";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/features/auth/utils/session";
import { PageHeaderProvider } from "@/contexts/page-header-context";
import { QueryTrackerBoundary } from "@/components/dev/query-tracker-boundary";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dashboard always requires authentication
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/dashboard");

  // Status-based redirects (backstop for proxy; ensures correct redirect in all runtimes)
  if (!user.emailVerified || user.status === "pending_verification")
    redirect("/verify-email");
  if (user.status === "email_verified") redirect("/join-code");
  if (user.status === "incomplete_profile") redirect("/onboarding");

  return (
    <QueryTrackerBoundary label="RSC /dashboard">
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
    </QueryTrackerBoundary>
  );
}

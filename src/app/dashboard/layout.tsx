import { AuthenticatedSidebar } from "@/components/authenticated-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/auth/auth.utils";
import { redirect } from "next/navigation";

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
        <SiteHeader />
        <div className="bg-muted/20">
          <div className="container mx-auto flex-1 p-4">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

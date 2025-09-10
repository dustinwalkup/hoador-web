import { AuthenticatedSidebar } from "@/components/authenticated-sidebar";
import { PublicSidebar } from "@/components/public-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/features/auth/utils/session";

export default async function ListingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated - don't redirect, just check
  const user = await getCurrentUser().catch(() => null);

  return (
    <SidebarProvider>
      {user ? (
        <AuthenticatedSidebar user={user} variant="inset" />
      ) : (
        <PublicSidebar variant="inset" />
      )}
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/20">
          <div className="container mx-auto flex-1 p-4">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

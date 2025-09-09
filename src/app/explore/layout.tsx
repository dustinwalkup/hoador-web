import { PublicSidebar } from "@/components/public-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only unauthenticated users reach this layout (authenticated users are redirected to /dashboard/explore)
  return (
    <SidebarProvider>
      <PublicSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/20">
          <div className="container mx-auto flex-1 p-4">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

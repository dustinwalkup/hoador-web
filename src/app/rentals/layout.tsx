import { AuthenticatedSidebar } from "@/components/authenticated-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/auth/auth-utils";
import { redirect } from "next/navigation";

export default async function RentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Rentals always require authentication
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AuthenticatedSidebar user={user} variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="bg-muted/20">
          <div className="flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

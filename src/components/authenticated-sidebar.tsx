"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";

// import { NavDocuments } from "@/components/nav-documents";
// import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserProfile } from "@/dal/types";
import { useMobileSidebarClose } from "@/hooks/use-mobile-sidebar-close";
import { Logo } from "@/components/logo";
import { NavMain } from "./nav-main";

interface AuthenticatedSidebarProps extends React.ComponentProps<
  typeof Sidebar
> {
  user: UserProfile;
}

const isAdmin = (user: UserProfile) =>
  user.userType === "admin" || user.userType === "superadmin";

export function AuthenticatedSidebar({
  user,
  ...props
}: AuthenticatedSidebarProps) {
  // Auto-close mobile sidebar on navigation
  useMobileSidebarClose();
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/">
              <SidebarMenuButton asChild className="p-0">
                <Logo
                  width={100}
                  height={20}
                  showBetaTag
                  betaTagPosition="right"
                  absolutePosition="right-6 md:right-0!"
                  className="h-5! w-auto"
                  style={{ height: "1.25rem", width: "auto" }}
                  priority
                />
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        {isAdmin(user) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/admin/dashboard">
                    <SidebarMenuButton
                      size="lg"
                      tooltip="Admin"
                      isActive={pathname.startsWith("/admin")}
                    >
                      <Shield className="text-primary size-5!" />
                      <span>Admin</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* TODO: Add documents */}
        {/* <NavDocuments /> */}
        {/* <NavSecondary className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

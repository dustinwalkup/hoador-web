"use client";

import Link from "next/link";

// import { NavDocuments } from "@/components/nav-documents";
// import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

export function AuthenticatedSidebar({
  user,
  ...props
}: AuthenticatedSidebarProps) {
  // Auto-close mobile sidebar on navigation
  useMobileSidebarClose();

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
                />
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
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

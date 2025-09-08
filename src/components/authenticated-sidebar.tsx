"use client";

import Image from "next/image";
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
import { NavMain } from "./nav-main";

interface AuthenticatedSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
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
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <Image
                  src="/hoador-logo.svg"
                  alt="Hoador Logo"
                  width={177}
                  height={36}
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

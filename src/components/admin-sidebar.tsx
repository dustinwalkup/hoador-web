"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  Users,
  Settings,
  ClipboardCheck,
  Scale,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { UserProfile } from "@/dal/types";
import { useMobileSidebarClose } from "@/hooks/use-mobile-sidebar-close";
import { usePendingReviewCount } from "@/features/admin/hooks/use-pending-review-count";
import { usePendingDisputesCount } from "@/features/admin/hooks/use-pending-disputes-count";
import { NavUser } from "./nav-user";

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProfile;
}

const adminNavItems = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Listing Review",
    url: "/admin/dashboard/listings/review",
    icon: ClipboardCheck,
  },
  {
    title: "Dispute Review",
    url: "/admin/dashboard/disputes/review",
    icon: Scale,
  },
  {
    title: "Legal Documents",
    url: "/admin/dashboard/legal",
    icon: FileText,
  },
  {
    title: "Support Items",
    url: "/admin/dashboard/support",
    icon: HelpCircle,
  },
  {
    title: "User Management",
    url: "/admin/dashboard/users",
    icon: Users,
  },
  {
    title: "Settings",
    url: "/admin/dashboard/settings",
    icon: Settings,
  },
];

export function AdminSidebar({ user, ...props }: AdminSidebarProps) {
  // Auto-close mobile sidebar on navigation
  useMobileSidebarClose();
  const pathname = usePathname();
  const { data: pendingCount = 0 } = usePendingReviewCount();
  const { data: pendingDisputesCount = 0 } = usePendingDisputesCount();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/admin/dashboard">
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:p-1.5!"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <Image
                    src="/hoador-logo.svg"
                    alt="Hoador Logo"
                    width={100}
                    height={20}
                  />
                  <span className="text-muted-foreground absolute right-5 z-50 text-xs font-semibold">
                    Admin
                  </span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {adminNavItems.map((item) => {
            // Dashboard should only be active on exact match
            // Other items can be active on exact match or sub-routes
            const isActive =
              item.url === "/admin/dashboard"
                ? pathname === item.url
                : pathname === item.url || pathname.startsWith(item.url + "/");

            // Check if this is the Listing Review item and has pending reviews
            const isListingReview =
              item.url === "/admin/dashboard/listings/review";
            const hasPendingReviews = isListingReview && pendingCount > 0;

            // Check if this is the Dispute Review item and has pending disputes
            const isDisputeReview =
              item.url === "/admin/dashboard/disputes/review";
            const hasPendingDisputes =
              isDisputeReview && pendingDisputesCount > 0;

            return (
              <SidebarMenuItem key={item.title}>
                <Link href={item.url}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    {item.icon && <item.icon className="size-5!" />}
                    <span>{item.title}</span>
                    {hasPendingReviews && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                      >
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </Badge>
                    )}
                    {hasPendingDisputes && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                      >
                        {pendingDisputesCount > 99
                          ? "99+"
                          : pendingDisputesCount}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

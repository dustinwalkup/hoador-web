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
  BookOpen,
  Bell,
  Shield,
  CreditCard,
  History,
  Repeat,
  MessageSquare,
  Home,
  Building2,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserProfile } from "@/dal/types";
import { useMobileSidebarClose } from "@/hooks/use-mobile-sidebar-close";
import { useAdminBadges } from "@/features/admin/hooks/use-admin-badges";
import { NavUser } from "./nav-user";

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProfile;
}

const adminNavItemsBeforePayments = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Dispute Review",
    url: "/admin/dashboard/disputes/review",
    icon: Scale,
  },
];

const paymentsNavItems = [
  { title: "Lifecycle", url: "/admin/dashboard/payments", icon: CreditCard },
  {
    title: "Cron History",
    url: "/admin/dashboard/payments/cron-history",
    icon: History,
  },
];

const adminNavItemsAfterPayments = [
  {
    title: "Legal Documents",
    url: "/admin/dashboard/legal",
    icon: FileText,
  },
  {
    title: "Support Items (Coming Soon)",
    url: "/admin/dashboard/support",
    icon: HelpCircle,
  },
  {
    title: "User Management",
    url: "/admin/dashboard/users",
    icon: Users,
  },
  {
    title: "Communities",
    url: "/admin/dashboard/communities",
    icon: Building2,
  },
  {
    title: "Settings (Coming Soon)",
    url: "/admin/dashboard/settings",
    icon: Settings,
  },
];

const howItWorksNavItems = [
  {
    title: "Notifications",
    url: "/admin/dashboard/how-it-works/notifications",
    icon: Bell,
  },
  {
    title: "Authentication",
    url: "/admin/dashboard/how-it-works/authentication",
    icon: Shield,
  },
  {
    title: "Payments",
    url: "/admin/dashboard/how-it-works/payments",
    icon: CreditCard,
  },
  {
    title: "Rentals",
    url: "/admin/dashboard/how-it-works/rentals",
    icon: Repeat,
  },
  {
    title: "Messaging",
    url: "/admin/dashboard/how-it-works/messaging",
    icon: MessageSquare,
  },
];

export function AdminSidebar({ user, ...props }: AdminSidebarProps) {
  // Auto-close mobile sidebar on navigation
  useMobileSidebarClose();
  const pathname = usePathname();
  const { data: badges } = useAdminBadges();
  const pendingCount = badges?.pendingListingReviews ?? 0;
  const pendingServiceCount = badges?.pendingServiceReviews ?? 0;
  const pendingDisputesCount = badges?.pendingDisputes ?? 0;

  const rentalsReviewUrl = "/admin/dashboard/listings/review";
  const servicesReviewUrl = "/admin/dashboard/services/listings/review";
  const isRentalsReviewActive =
    pathname === rentalsReviewUrl ||
    pathname.startsWith(rentalsReviewUrl + "/");
  const isServicesReviewActive =
    pathname === servicesReviewUrl ||
    pathname.startsWith(servicesReviewUrl + "/");
  const isListingReviewActive = isRentalsReviewActive || isServicesReviewActive;
  const pendingTotalCount = pendingCount + pendingServiceCount;

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
                    priority
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItemsBeforePayments.map((item) => {
                const isActive =
                  item.url === "/admin/dashboard"
                    ? pathname === item.url
                    : pathname === item.url ||
                      pathname.startsWith(item.url + "/");
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

            <Collapsible
              defaultOpen={isListingReviewActive}
              className="group/collapsible"
            >
              <CollapsibleTrigger asChild>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Listing review"
                    isActive={isListingReviewActive}
                  >
                    <ClipboardCheck className="size-5!" />
                    <span>Listing review</span>
                    {pendingTotalCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                      >
                        {pendingTotalCount > 99 ? "99+" : pendingTotalCount}
                      </Badge>
                    )}
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      asChild
                      size="md"
                      isActive={isRentalsReviewActive}
                    >
                      <Link href={rentalsReviewUrl}>
                        <span>{`Rentals (${
                          pendingCount > 99 ? "99+" : pendingCount
                        })`}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      asChild
                      size="md"
                      isActive={isServicesReviewActive}
                    >
                      <Link href={servicesReviewUrl}>
                        <span>{`Services (${
                          pendingServiceCount > 99 ? "99+" : pendingServiceCount
                        })`}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>
        <Collapsible
          defaultOpen={pathname.startsWith("/admin/dashboard/payments")}
        >
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group text-sidebar-foreground/70 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full shrink-0 cursor-pointer items-center rounded-md px-2 text-left text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
                )}
              >
                <CreditCard className="size-4" />
                <span className="ml-2 text-sm font-medium">Payments</span>
                <ChevronDown
                  className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {paymentsNavItems.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      pathname.startsWith(item.url + "/");
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
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItemsAfterPayments.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url + "/");
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
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/dashboard">
                  <SidebarMenuButton size="lg" tooltip="User dashboard">
                    <Home className="size-5!" />
                    <span>User dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Collapsible defaultOpen={false}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group text-sidebar-foreground/70 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-8 w-full shrink-0 cursor-pointer items-center rounded-md px-2 text-left text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
                )}
              >
                <BookOpen className="size-4" />
                <span className="ml-2 text-sm font-medium">
                  How Things Work
                </span>
                <ChevronDown
                  className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {howItWorksNavItems.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      pathname.startsWith(item.url + "/");
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
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

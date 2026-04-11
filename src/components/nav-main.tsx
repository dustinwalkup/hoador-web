"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { DASHBOARD } from "@/constants/navbar";
import { useUnreadMessageCount } from "@/features/messages/hooks/use-unread-count";

const { mainNav } = DASHBOARD;

export function NavMain() {
  const pathname = usePathname();
  const { data: unreadCount = 0 } = useUnreadMessageCount();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {mainNav.map((item) => {
            // Check if this item has children (nested items)
            if (item.items && item.items.length > 0) {
              // Check if any sub-item is active
              const hasActiveChild = item.items.some((group) =>
                group.items.some(
                  (subItem) =>
                    pathname === subItem.url ||
                    pathname.startsWith(subItem.url + "/"),
                ),
              );

              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.defaultOpen || hasActiveChild}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        tooltip={item.title}
                        isActive={hasActiveChild}
                      >
                        {item.icon && <item.icon className="size-5!" />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((group, groupIndex) => (
                          <div key={group.label ?? groupIndex}>
                            {groupIndex > 0 && (
                              <div className="bg-sidebar-border my-2 h-px" />
                            )}
                            {group.label && (
                              <SidebarGroupLabel className="mb-1 px-2 font-bold">
                                {group.label}
                              </SidebarGroupLabel>
                            )}
                            {group.items.map((subItem) => {
                              const isSubItemActive =
                                pathname === subItem.url ||
                                pathname.startsWith(subItem.url + "/");

                              return (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isSubItemActive}
                                  >
                                    <Link href={subItem.url}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </div>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            // Regular menu item without children
            let isActive = pathname === item.url;

            // Handle nested URLs for non-dashboard root items
            if (!isActive && item.url && item.url !== "/dashboard") {
              isActive = pathname.startsWith(item.url + "/");
            }

            // Check if this is the Mailbox item and has unread messages
            const isMailbox = item.url === "/dashboard/mailbox";
            const hasUnread = isMailbox && unreadCount > 0;

            return (
              <SidebarMenuItem key={item.title} className="cursor-pointer!">
                <Link href={item.url!} passHref>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    {item.icon && <item.icon className="size-5!" />}
                    <span>{item.title}</span>
                    {hasUnread && (
                      <Badge
                        variant="destructive"
                        className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

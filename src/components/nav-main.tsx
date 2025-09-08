"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DASHBOARD } from "@/constants/navbar";

const { mainNav } = DASHBOARD;

export function NavMain() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {/* <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <PlusCircleIcon />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <MailIcon />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu> */}
        <SidebarMenu>
          {mainNav.map((item) => {
            let isActive = pathname === item.url;

            // Handle nested URLs for non-dashboard root items
            if (!isActive && item.url !== "/dashboard") {
              isActive = pathname.startsWith(item.url + "/");
            }

            // Special case for Rentals navigation item - should be active for all renting/lending routes
            if (!isActive && item.url === "/dashboard/renting/requests") {
              isActive =
                pathname.startsWith("/dashboard/renting/") ||
                pathname.startsWith("/dashboard/lending/");
            }

            return (
              <SidebarMenuItem key={item.title} className="!cursor-pointer">
                <Link href={item.url} passHref>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
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

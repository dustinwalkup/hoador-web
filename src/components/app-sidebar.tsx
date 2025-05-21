"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import {
  BookOpenIcon,
  CreditCardIcon,
  FileSignatureIcon,
  HelpCircleIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NavMain } from "./nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { mainNav } from "@/lib/constants";

const data = {
  user: {
    name: "stevemiller",
    email: "stevemiller@gmail.com",
    avatar: "/images/mock/testUser.jpg",
  },

  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: SettingsIcon,
    },
    {
      title: "Get Help",
      url: "#",
      icon: HelpCircleIcon,
    },
    {
      title: "Search",
      url: "#",
      icon: SearchIcon,
    },
  ],
  documents: [
    {
      name: "Rental Agreements",
      url: "/agreements",
      icon: FileSignatureIcon,
    },
    {
      name: "Invoices & Receipts",
      url: "/invoices",
      icon: CreditCardIcon,
    },
    {
      name: "Safety Manuals",
      url: "/safety-manuals",
      icon: BookOpenIcon,
    },
    {
      name: "FAQs",
      url: "/faq",
      icon: HelpCircleIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={mainNav} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}

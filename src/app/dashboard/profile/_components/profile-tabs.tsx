"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PROFILE_TABS } from "@/lib/constants/profile";
import { Tabs, TabsList, TabsContent } from "@/components/ui/tabs";
import { ProfileTabTrigger } from "./profile-tab-trigger";

interface ProfileTabsProps {
  children: ReactNode;
}

export function ProfileTabs({ children }: ProfileTabsProps) {
  const pathname = usePathname();

  // Determine the active tab based on the current pathname
  const getActiveTab = () => {
    if (pathname === "/dashboard/profile") return "profile";
    const tabValue = pathname.split("/").pop();
    return tabValue || "profile";
  };

  const activeTab = getActiveTab();

  return (
    <Tabs value={activeTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-6">
        {PROFILE_TABS.tabValues.map((tab) => (
          <ProfileTabTrigger key={tab.value} tab={tab} />
        ))}
      </TabsList>

      <TabsContent value={activeTab} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
}

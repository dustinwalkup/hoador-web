"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PROFILE_TABS } from "@/constants/profile";
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
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="grid w-full min-w-max grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-3">
          {PROFILE_TABS.tabValues.map((tab) => (
            <ProfileTabTrigger key={tab.value} tab={tab} />
          ))}
        </TabsList>
      </div>

      <TabsContent value={activeTab} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
}

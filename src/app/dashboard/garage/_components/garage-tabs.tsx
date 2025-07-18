"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GarageTabsProps {
  currentTab: string;
  children: React.ReactNode;
}

export function GarageTabs({ currentTab, children }: GarageTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === "active") {
      params.delete("tab");
    } else {
      params.set("tab", value);
      // Clear rental status filter when switching to inactive or archived tabs
      params.delete("rentalStatus");
    }

    router.push(`/dashboard/garage?${params.toString()}`);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mb-6">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
        <TabsTrigger value="archived">Archived</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}

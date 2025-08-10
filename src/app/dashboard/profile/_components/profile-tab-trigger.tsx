"use client";

import { usePathname, useRouter } from "next/navigation";
import { TabsTrigger } from "@/components/ui/tabs";

interface ProfileTabTriggerProps {
  tab: { value: string; label: string };
}

export function ProfileTabTrigger({ tab }: ProfileTabTriggerProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive =
    pathname === `/dashboard/profile/${tab.value}` ||
    (pathname === "/dashboard/profile" && tab.value === "profile");

  const handleClick = () => {
    const href =
      tab.value === "profile"
        ? "/dashboard/profile"
        : `/dashboard/profile/${tab.value}`;
    router.push(href);
  };

  return (
    <TabsTrigger
      value={tab.value}
      onClick={handleClick}
      className={`${
        isActive ? "bg-background" : ""
      } px-2 py-2 text-xs whitespace-nowrap sm:text-sm`}
    >
      {tab.label}
    </TabsTrigger>
  );
}

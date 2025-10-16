"use client";

import { usePathname } from "next/navigation";
import { DASHBOARD } from "@/constants/navbar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

const { mainNav } = DASHBOARD;

export function SiteHeaderLabel() {
  const pathname = usePathname();
  const label = mainNav.find((item) => item.url === pathname)?.title;

  return (
    <div className="flex w-full items-center justify-between">
      <h1 className="text-xl font-medium">{label}</h1>
      <NotificationBell />
    </div>
  );
}

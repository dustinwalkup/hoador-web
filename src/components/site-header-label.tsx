"use client";

import { usePathname } from "next/navigation";
import { BellIcon } from "lucide-react";
import { Button } from "./ui/button";
import { DASHBOARD } from "@/lib/constants/navbar";

const { mainNav } = DASHBOARD;
const NUMBER_OF_NOTIFICATIONS = 3;

export function SiteHeaderLabel() {
  const pathname = usePathname();
  const label = mainNav.find((item) => item.url === pathname)?.title;

  return (
    <div className="flex w-full items-center justify-between">
      <h1 className="text-xl font-medium">{label}</h1>
      <Button variant="ghost" className="relative h-8 w-8" size="icon">
        <BellIcon className="h-4 w-4" />
        <span className="sr-only">Notifications</span>
        <span className="bg-destructive text-primary-foreground absolute -top-1 -right-1 flex size-2 items-center justify-center rounded-full p-2 text-xs">
          {NUMBER_OF_NOTIFICATIONS}
        </span>
      </Button>
    </div>
  );
}

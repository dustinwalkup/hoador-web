"use client";

import { usePathname } from "next/navigation";

import { mainNav } from "@/lib/constants";

export function SiteHeaderLabel() {
  const pathname = usePathname();
  const label = mainNav.find((item) => item.url === pathname)?.title;

  return <h1 className="text-base font-medium">{label}</h1>;
}

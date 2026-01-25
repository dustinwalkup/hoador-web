"use client";

import { usePathname, useRouter } from "next/navigation";
import { TabsTrigger } from "@/components/ui/tabs";

interface PaymentsTabTriggerProps {
  tab: { value: string; label: string };
}

export function PaymentsTabTrigger({ tab }: PaymentsTabTriggerProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive =
    pathname === `/dashboard/payments/${tab.value}` ||
    (pathname === "/dashboard/payments" && tab.value === "payments");

  const handleClick = () => {
    const href =
      tab.value === "payments"
        ? "/dashboard/payments"
        : `/dashboard/payments/${tab.value}`;
    router.push(href);
  };

  return (
    <TabsTrigger
      value={tab.value}
      onClick={handleClick}
      className={`${
        isActive ? "bg-background" : ""
      } min-w-40 px-2 py-2 text-xs whitespace-nowrap sm:text-sm`}
    >
      {tab.label}
    </TabsTrigger>
  );
}

"use client";

import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hideRentalHeader } from "@/features/rentals/lib/utils";

interface RentalsTabsProps {
  children: React.ReactNode;
}

export function RentalsTabs({ children }: RentalsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Extract the current type from the path (renting or lending)
  const currentType = pathname.includes("/lending") ? "lending" : "renting";
  const hideTabs = hideRentalHeader(pathname);

  const handleTabChange = (value: string) => {
    // Default to the first sub-tab when switching main tabs
    if (value === "renting") {
      router.push("/dashboard/renting/requests");
    } else {
      router.push("/dashboard/lending/incoming");
    }
  };

  return (
    <Tabs value={currentType} onValueChange={handleTabChange}>
      {!hideTabs && (
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="renting">Renting</TabsTrigger>
          <TabsTrigger value="lending">Lending</TabsTrigger>
        </TabsList>
      )}

      {children}
    </Tabs>
  );
}

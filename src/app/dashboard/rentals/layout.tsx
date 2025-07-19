"use client";

import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

export default function RentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Extract the current type from the path (renting or lending)
  const currentType = pathname.includes("/lending") ? "lending" : "renting";
  const isConfirmationPage = pathname.includes("/confirmation");

  const handleTabChange = (value: string) => {
    // Default to the first sub-tab when switching main tabs
    if (value === "renting") {
      router.push("/dashboard/rentals/renting/requests");
    } else {
      router.push("/dashboard/rentals/lending/incoming");
    }
  };

  return (
    <div className="container mx-auto py-6">
      {!isConfirmationPage && (
        <PageHeader
          title="Rentals"
          description="Manage your rentals"
          className="mb-8"
        />
      )}
      <Tabs value={currentType} onValueChange={handleTabChange}>
        {!isConfirmationPage && (
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="renting">Renting</TabsTrigger>
            <TabsTrigger value="lending">Lending</TabsTrigger>
          </TabsList>
        )}

        {children}
      </Tabs>
    </div>
  );
}

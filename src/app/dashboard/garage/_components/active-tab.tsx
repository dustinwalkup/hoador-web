import Link from "next/link";
import { Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/auth.utils";
import { capitalize } from "@/lib/utils/utils";
import { toolDAL } from "@/dal";
import type { GarageToolFilters } from "@/dal/tool.dal";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";

function getStatus(status: string): "rented" | "listed" | "" {
  if (status === "available") return "listed";
  if (status === "rented") return "rented";
  return "";
}

interface ActiveTabProps {
  filters: GarageToolFilters;
}

export async function ActiveTab({ filters }: ActiveTabProps) {
  const user = await getCurrentUser();
  const activeTools = await toolDAL.getUserActiveToolsWithFilters(
    user.id,
    filters,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {activeTools && activeTools.length > 0 ? (
        activeTools.map((tool) => (
          <RentalCard
            key={tool.id}
            id={tool.id}
            name={tool.name}
            imageUrl={tool.firstImageUrl}
            status={getStatus(tool.status)}
            price={`$${tool.dailyRate}/day`}
            availability={capitalize(tool.status)}
            cardType="listings"
            toolData={{
              id: tool.id,
              name: tool.name,
              status: tool.status,
              isActive: tool.isActive,
            }}
          />
        ))
      ) : (
        <div className="col-span-full py-8 text-center">
          <p className="text-muted-foreground mb-4">
            {filters.query || filters.categoryId || filters.rentalStatus
              ? "No tools found matching your search criteria"
              : "No active tools listed"}
          </p>
          {filters.query || filters.categoryId || filters.rentalStatus ? (
            <p className="text-muted-foreground text-sm">
              Try adjusting your search or filters
            </p>
          ) : null}
        </div>
      )}
      <Card className="items-center justify-center overflow-hidden border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-primary/10 mb-4 rounded-full p-3">
            <Plus className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="mb-2 text-lg">List a New Tool</CardTitle>
          <p className="text-muted-foreground mb-4 text-center text-sm">
            Share your tools with neighbors and earn extra income
          </p>
          <Button asChild>
            <Link href="/dashboard/tools/add">Add New Listing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

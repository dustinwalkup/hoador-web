import { Plus, Package } from "lucide-react";
import { tryCatch } from "@walkup/walkup-utils";

import { rentalDAL } from "@/lib/dal";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";

export async function BorrowingTab() {
  const { data, error } = await tryCatch(rentalDAL.getBorrowedTools());

  if (error || !data || data === null) {
    console.error("Error fetching borrowed tools:", error);
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (dailyRate: string) => {
    return `$${parseFloat(dailyRate).toFixed(2)}/day`;
  };

  const mapRentalStatus = (
    dbStatus: string,
  ): "rented" | "" | "listed" | "renting" => {
    switch (dbStatus) {
      case "approved":
      case "active":
        return "renting";
      case "completed":
        return "rented";
      default:
        return "";
    }
  };

  const currentRentals = data?.currentRentals || [];
  const upcomingRentals = data?.upcomingRentals || [];

  return (
    <>
      <div className="mb-4">
        <Badge variant="outline" className="mb-2">
          Current Rentals
        </Badge>

        {currentRentals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <div className="bg-muted mb-4 rounded-full p-3">
                <Package className="text-muted-foreground h-6 w-6" />
              </div>
              <CardTitle className="mb-2 text-lg">No Current Rentals</CardTitle>
              <p className="text-muted-foreground mb-4 text-center text-sm">
                You&apos;re not currently renting any tools. Start exploring to
                find tools in your area!
              </p>
              <Button asChild>
                <a href="/dashboard/explore">Explore Tools</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentRentals.map((tool) => (
              <RentalCard
                key={tool.id}
                name={tool.toolName}
                id={tool.toolId}
                owner={tool.ownerName}
                imageUrl={tool.toolImageUrl}
                dueDate={formatDate(tool.endDate)}
                status={mapRentalStatus(tool.status)}
                cardType="borrowing"
                price={formatPrice(tool.dailyRate)}
              />
            ))}
          </div>
        )}
      </div>

      <Separator className="my-6" />

      <div>
        <Badge variant="outline" className="mb-2">
          Upcoming Rentals
        </Badge>

        {upcomingRentals.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="overflow-hidden border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="bg-primary/10 mb-4 rounded-full p-3">
                  <Plus className="text-primary h-6 w-6" />
                </div>
                <CardTitle className="mb-2 text-lg">Find More Tools</CardTitle>
                <p className="text-muted-foreground mb-4 text-center text-sm">
                  Browse thousands of tools available in your area
                </p>
                <Button asChild>
                  <a href="/dashboard/explore">Explore Tools</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingRentals.map((tool) => (
              <RentalCard
                key={tool.id}
                name={tool.toolName}
                id={tool.toolId}
                owner={tool.ownerName}
                imageUrl={tool.toolImageUrl}
                dueDate={formatDate(tool.startDate)}
                status={mapRentalStatus(tool.status)}
                cardType="borrowing"
                price={formatPrice(tool.dailyRate)}
              />
            ))}
            <Card className="overflow-hidden border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="bg-primary/10 mb-4 rounded-full p-3">
                  <Plus className="text-primary h-6 w-6" />
                </div>
                <CardTitle className="mb-2 text-lg">Find More Tools</CardTitle>
                <p className="text-muted-foreground mb-4 text-center text-sm">
                  Browse thousands of tools available in your area
                </p>
                <Button asChild>
                  <a href="/dashboard/explore">Explore Tools</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

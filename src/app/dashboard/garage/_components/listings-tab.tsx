import Link from "next/link";
import { Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/auth-utils";
import { toolDAL } from "@/lib/dal";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";

export async function ListingsTab() {
  const user = await getCurrentUser();
  const userTools = await toolDAL.getUserTools(user.id);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {userTools && userTools.length > 0 ? (
        userTools.map((tool) => (
          <RentalCard
            key={tool.id}
            id={tool.id}
            name={tool.name}
            imageUrl={tool.firstImageUrl}
            status="listed"
            price={`$${tool.dailyRate}/day`}
            availability={
              tool.status === "available"
                ? "Available"
                : tool.status === "rented"
                  ? "Currently Lent"
                  : tool.status
            }
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
          <p className="text-muted-foreground mb-4">No tools listed yet</p>
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

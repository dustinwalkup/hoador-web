import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RentalCard from "@/components/dashboard/rental-card";
import { Plus } from "lucide-react";

export function BorrowingTab() {
  return (
    <>
      <div className="mb-4">
        <Badge variant="outline" className="mb-2">
          Active Rentals
        </Badge>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RentalCard
            name="Pressure Washer"
            id={"123"}
            owner="John D."
            imageUrl="/images/mock/pressure-washer.jpg"
            dueDate="May 25, 2023"
            status="renting"
            cardType="borrowing"
            price="$15/day"
          />
          <RentalCard
            name="Circular Saw"
            id={"123"}
            owner="Maria G."
            imageUrl="/images/mock/skill-saw.jpg"
            dueDate="May 28, 2023"
            status="renting"
            cardType="borrowing"
            price="$12/day"
          />
          <RentalCard
            name="Ladder (8ft)"
            id={"123"}
            owner="Robert T."
            imageUrl="/images/mock/ladder.jpg"
            dueDate="May 30, 2023"
            status="renting"
            cardType="borrowing"
            price="$6/day"
          />
        </div>
      </div>
      <Separator className="my-6" />
      <div>
        <Badge variant="outline" className="mb-2">
          Upcoming Rentals
        </Badge>
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
      </div>
    </>
  );
}

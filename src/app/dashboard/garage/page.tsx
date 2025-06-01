"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  ArrowRight,
} from "lucide-react";
import RentalCard from "@/components/dashboard/rental-card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GaragePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Garage</h1>
          <p className="text-muted-foreground">
            Manage your tools and rentals in one place
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add New Tool
          </Button>

          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none rounded-l-md"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-none rounded-r-md"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">List view</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="borrowing" className="mb-6">
        <TabsList>
          <TabsTrigger value="borrowing">Borrowing</TabsTrigger>
          <TabsTrigger value="lent-out">Lent Out</TabsTrigger>
          <TabsTrigger value="listings">My Listings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex w-full max-w-sm items-center">
            <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
            <Input placeholder="Search tools..." className="pl-9" />
          </div>

          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>

            <Button variant="outline" size="icon" className="h-9 w-9">
              <Calendar className="h-4 w-4" />
              <span className="sr-only">Calendar view</span>
            </Button>
          </div>
        </div>

        <TabsContent value="borrowing" className="mt-6">
          <div className="mb-4">
            <Badge variant="outline" className="mb-2">
              Active Rentals
            </Badge>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <RentalCard
                name="Pressure Washer"
                owner="John D."
                imageUrl="/images/mock/pressure-washer.jpg"
                dueDate="May 25, 2023"
                status="active"
                price="$15/day"
              />
              <RentalCard
                name="Circular Saw"
                owner="Maria G."
                imageUrl="/images/mock/skill-saw.jpg"
                dueDate="May 28, 2023"
                status="active"
                price="$12/day"
              />
              <RentalCard
                name="Ladder (8ft)"
                owner="Robert T."
                imageUrl="/images/mock/ladder.jpg"
                dueDate="May 30, 2023"
                status="active"
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
                  <CardTitle className="mb-2 text-lg">
                    Find More Tools
                  </CardTitle>
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
        </TabsContent>

        <TabsContent value="lent-out" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RentalCard
              name="Drill Set"
              borrower="Emily K."
              imageUrl="/images/mock/drill-set.jpg"
              dueDate="May 26, 2023"
              status="lent"
              price="$10/day"
            />
            <RentalCard
              name="Lawn Mower"
              borrower="David P."
              imageUrl="/images/mock/lawn-mower.jpg"
              dueDate="June 2, 2023"
              status="lent"
              price="$20/day"
            />
          </div>
        </TabsContent>

        <TabsContent value="listings" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RentalCard
              name="Drill Set"
              imageUrl="/images/mock/drill-set.jpg"
              status="listed"
              price="$10/day"
              availability="Available"
            />
            <RentalCard
              name="Lawn Mower"
              imageUrl="/images/mock/lawn-mower.jpg"
              status="listed"
              price="$20/day"
              availability="Currently Lent"
            />
            <RentalCard
              name="Hedge Trimmer"
              imageUrl="/images/mock/hedge-trimmer.jpg"
              status="listed"
              price="$15/day"
              availability="Available"
            />

            <Card className="overflow-hidden border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <div className="bg-primary/10 mb-4 rounded-full p-3">
                  <Plus className="text-primary h-6 w-6" />
                </div>
                <CardTitle className="mb-2 text-lg">List a New Tool</CardTitle>
                <p className="text-muted-foreground mb-4 text-center text-sm">
                  Share your tools with neighbors and earn extra income
                </p>
                <Button>Add New Listing</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b p-4 font-medium">
              <div>Tool</div>
              <div>Status</div>
              <div>Date</div>
              <div>Amount</div>
            </div>
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b p-4 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-muted h-10 w-10 rounded"></div>
                  <div>
                    <div className="font-medium">Tool Name</div>
                    <div className="text-muted-foreground text-sm">
                      Owner/Borrower Name
                    </div>
                  </div>
                </div>
                <div>
                  <Badge variant="outline">Completed</Badge>
                </div>
                <div className="text-muted-foreground text-sm">
                  Apr 15, 2023
                </div>
                <div className="font-medium">$12.00</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm">
              View Complete History
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

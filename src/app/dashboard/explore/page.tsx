import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Filter, ChevronDown, Grid3X3, List } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import CategoryButton from "@/components/dashboard/category-button";
import ToolCard from "@/components/dashboard/tool-card";

export default function ExplorePage() {
  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Explore Tools</h1>
          <p className="text-muted-foreground">
            Find tools available in your neighborhood
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter Tools</SheetTitle>
                <SheetDescription>
                  Narrow down your search with these filters
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Distance</h3>
                  <div className="space-y-4">
                    <Slider defaultValue={[5]} max={20} step={1} />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        0 miles
                      </span>
                      <span className="text-xs font-medium">5 miles</span>
                      <span className="text-muted-foreground text-xs">
                        20 miles
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Price Range</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="min-price" className="text-xs">
                        Min
                      </Label>
                      <Input id="min-price" placeholder="$0" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="max-price" className="text-xs">
                        Max
                      </Label>
                      <Input
                        id="max-price"
                        placeholder="$100"
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Categories</h3>
                  <div className="space-y-2">
                    {[
                      "Power Tools",
                      "Hand Tools",
                      "Lawn & Garden",
                      "Ladders",
                      "Painting",
                      "Plumbing",
                    ].map((category) => (
                      <div
                        key={category}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox id={`category-${category}`} />
                        <label
                          htmlFor={`category-${category}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Availability</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="available-now" />
                      <label
                        htmlFor="available-now"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Available now
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="available-weekend" />
                      <label
                        htmlFor="available-weekend"
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Available this weekend
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button variant="outline" className="w-full">
                  Reset Filters
                </Button>
                <Button className="w-full">Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Sort
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  Nearest first
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  Price: Low to high
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  Price: High to low
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  Highest rated
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm"
                >
                  Recently added
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none rounded-l-md border-r"
            >
              <Grid3X3 className="h-4 w-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-none rounded-r-md"
            >
              <List className="h-4 w-4" />
              <span className="sr-only">List view</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-nowrap gap-2 overflow-x-auto pb-2">
        <CategoryButton icon="🔨" label="All Tools" active />
        <CategoryButton icon="🔌" label="Power Tools" />
        <CategoryButton icon="🪚" label="Hand Tools" />
        <CategoryButton icon="🌱" label="Garden" />
        <CategoryButton icon="🪜" label="Ladders" />
        <CategoryButton icon="🎨" label="Painting" />
        <CategoryButton icon="🚚" label="Trucks" />
        <CategoryButton icon="🧰" label="Plumbing" />
      </div>

      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Tools</TabsTrigger>
          <TabsTrigger value="nearby">Nearby</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <ToolCard
          id="1"
          name="Power Drill"
          price="$8/day"
          distance="0.5 miles"
          rating={4.8}
          reviews={12}
          imageUrl="/images/mock/cordless-drill.jpg"
          isNew
        />

        <ToolCard
          id="2"
          name="Circular Saw"
          price="$12/day"
          distance="0.8 miles"
          rating={4.5}
          reviews={8}
          imageUrl="/images/mock/skill-saw.jpg"
        />

        <ToolCard
          id="3"
          name="Pressure Washer"
          price="$15/day"
          distance="1.2 miles"
          rating={4.9}
          reviews={24}
          imageUrl="/images/mock/pressure-washer.jpg"
        />

        <ToolCard
          id="4"
          name="Ladder (8ft)"
          price="$6/day"
          distance="0.3 miles"
          rating={4.7}
          reviews={15}
          imageUrl="/images/mock/ladder.jpg"
          isNew
        />

        <ToolCard
          id="5"
          name="Lawn Mower"
          price="$10/day"
          distance="0.7 miles"
          rating={4.6}
          reviews={19}
          imageUrl="/images/mock/lawn-mower.jpg"
        />

        <ToolCard
          id="6"
          name="Miter Saw"
          price="$20/day"
          distance="1.5 miles"
          rating={4.8}
          reviews={7}
          imageUrl="/images/mock/miter-saw.jpg"
        />

        <ToolCard
          id="7"
          name="Hedge Trimmer"
          price="$9/day"
          distance="0.9 miles"
          rating={4.4}
          reviews={11}
          imageUrl="/images/mock/hedge-trimmer.jpg"
        />

        <ToolCard
          id="8"
          name="Trailer Hitch"
          price="$18/day"
          distance="1.1 miles"
          rating={4.7}
          reviews={14}
          imageUrl="/images/mock/trailer-hitch.jpg"
          isNew
        />
      </div>

      <div className="mt-8 flex justify-center">
        <Button variant="outline">Load More</Button>
      </div>
    </div>
  );
}

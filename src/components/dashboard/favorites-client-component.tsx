"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Folder,
  Grid3X3,
  List,
  MoreHorizontal,
  Edit,
  Trash2,
} from "lucide-react";
import ToolCard from "@/components/dashboard/tool-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function FavoritesClientComponent() {
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const collections = [
    { id: "1", name: "Home Improvement", count: 5 },
    { id: "2", name: "Garden Tools", count: 3 },
    { id: "3", name: "Workshop", count: 7 },
  ];

  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Favorites</h1>
          <p className="text-muted-foreground">
            Tools and equipment you&apos;ve saved for later
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9">
                <Folder className="mr-2 h-4 w-4" />
                New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Collection</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="collection-name">Collection Name</Label>
                  <Input
                    id="collection-name"
                    placeholder="e.g., Home Improvement"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="collection-description">
                    Description (Optional)
                  </Label>
                  <Input
                    id="collection-description"
                    placeholder="What kind of tools go in this collection?"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Create Collection</Button>
              </div>
            </DialogContent>
          </Dialog>

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

      <Tabs
        defaultValue="all"
        className="mb-6"
        onValueChange={(value) => setActiveTab(value)}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Favorites</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="recent">Recently Added</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <ToolCard
              id="1"
              name="Power Drill"
              price="$8/day"
              distance="0.5 miles"
              rating={4.8}
              reviews={12}
              imageUrl="/images/mock/cordless-drill.jpg"
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
          </div>
        </TabsContent>

        <TabsContent value="collections" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {collections.map((collection) => (
              <Card key={collection.id} className="group overflow-hidden">
                <CardHeader className="relative p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{collection.name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {collection.count} items
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-muted/50 grid grid-cols-3 gap-1 p-1">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="bg-muted aspect-square"></div>
                    ))}
                  </div>
                  <div className="p-4">
                    <Button variant="outline" size="sm" className="w-full">
                      View Collection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="flex h-full flex-col items-center justify-center border-dashed p-6">
              <div className="bg-primary/10 mb-4 rounded-full p-3">
                <Plus className="text-primary h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Create Collection</h3>
              <p className="text-muted-foreground mb-4 text-center text-sm">
                Organize your favorite tools into custom collections
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Create New Collection</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Collection</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="collection-name-modal">
                        Collection Name
                      </Label>
                      <Input
                        id="collection-name-modal"
                        placeholder="e.g., Home Improvement"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="collection-description-modal">
                        Description (Optional)
                      </Label>
                      <Input
                        id="collection-description-modal"
                        placeholder="What kind of tools go in this collection?"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button>Create Collection</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <ToolCard
              id="7"
              name="Hedge Trimmer"
              price="$9/day"
              distance="0.9 miles"
              rating={4.4}
              reviews={11}
              imageUrl="/images/mock/hedge-trimmer.jpg"
              isNew
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
        </TabsContent>
      </Tabs>

      {activeTab === "all" && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
}

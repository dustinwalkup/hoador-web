import Link from "next/link";
import { Calendar, Search, Filter, Plus } from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

import { ActiveTab } from "./_components/active-tab";
import { InactiveTab } from "./_components/inactive-tab";
import { ArchivedTab } from "./_components/archived-tab";

export default async function GaragePage() {
  return (
    <div className="container py-6">
      <PageHeader
        title="Garage"
        description="Manage your tools and rentals in one place"
      >
        <Link href="/dashboard/tools/add">
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add New Tool
          </Button>
        </Link>
      </PageHeader>

      <Tabs defaultValue="active" className="mb-6">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
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
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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

        <TabsContent value="active" className="mt-6">
          <ActiveTab />
        </TabsContent>

        <TabsContent value="inactive" className="mt-6">
          <InactiveTab />
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <ArchivedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

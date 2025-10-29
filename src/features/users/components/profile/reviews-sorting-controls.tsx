"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";

interface ReviewsSortingControlsProps {
  sortBy: string;
  sortOrder: string;
}

export function ReviewsSortingControls({
  sortBy,
  sortOrder,
}: ReviewsSortingControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split("-");
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", newSortBy);
    params.set("sortOrder", newSortOrder);
    params.set("page", "1"); // Reset to first page when sorting changes
    router.push(`/dashboard/profile/reviews?${params.toString()}`);
  };

  return (
    <Select value={`${sortBy}-${sortOrder}`} onValueChange={handleSortChange}>
      <SelectTrigger className="w-full min-w-[140px] sm:w-40">
        <ArrowUpDown className="mr-2 h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="createdAt-desc">Newest First</SelectItem>
        <SelectItem value="createdAt-asc">Oldest First</SelectItem>
        <SelectItem value="rating-desc">Highest Rated</SelectItem>
        <SelectItem value="rating-asc">Lowest Rated</SelectItem>
      </SelectContent>
    </Select>
  );
}

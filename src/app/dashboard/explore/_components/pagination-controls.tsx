"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  basePath?: string; // Default to /dashboard/explore for backward compatibility
}

export function PaginationControls({
  pagination,
  basePath = "/dashboard/explore",
}: PaginationControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`${basePath}?${params.toString()}`);
  };

  if (pagination.totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      <div className="text-muted-foreground text-center text-sm sm:text-left">
        Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
        {pagination.total} tools
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={!pagination.hasPrev}
          className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from(
            { length: Math.min(5, pagination.totalPages) },
            (_, i) => {
              // Calculate which pages to show (up to 5 pages)
              let startPage = Math.max(1, pagination.page - 2);
              const endPage = Math.min(pagination.totalPages, startPage + 4);

              // Adjust start page if we're near the end
              if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
              }

              const pageNum = startPage + i;

              if (pageNum > endPage) return null;

              return (
                <Button
                  key={pageNum}
                  variant={pagination.page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="h-8 w-8 p-0 text-sm sm:h-9 sm:w-9"
                >
                  {pageNum}
                </Button>
              );
            },
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={!pagination.hasNext}
          className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

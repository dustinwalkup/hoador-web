import Link from "next/link";
import { Button } from "@/components/ui/button";
import ToolCard from "@/components/dashboard/tool-card";
import type { UserTool } from "@/dal/tool.dal";

interface ExplorePageContentProps {
  tools: UserTool[];
  basePath?: string; // Default to /dashboard/explore for backward compatibility
}

export function ExplorePageContent({
  tools,
  basePath = "/dashboard/explore",
}: ExplorePageContentProps) {
  return (
    <>
      {tools.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              id={tool.id}
              name={tool.name}
              price={`$${tool.dailyRate}/day`}
              distance="0.5 miles" // TODO: Calculate actual distance
              rating={tool.averageRating}
              reviews={tool.reviewCount}
              imageUrl={tool.firstImageUrl || "/images/placeholder.jpg"}
              isNew={
                new Date(tool.createdAt).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
          <div className="mb-4 text-6xl">🔍</div>
          <h3 className="mb-2 text-lg font-semibold">No tools found</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            We couldn&apos;t find any tools matching your search criteria. Try
            adjusting your filters or search terms.
          </p>
          <Button variant="outline" asChild>
            <Link href={basePath}>Clear all filters</Link>
          </Button>
        </div>
      )}
    </>
  );
}

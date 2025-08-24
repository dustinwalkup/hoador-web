import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rentalDAL } from "@/dal";
import type { LendingRequestItem, BorrowedTool } from "@/dal/rentals.dal";
import { RentingRequestsListWrapper } from "./_components/renting-requests-list-wrapper";
import { LendingRequestsListWrapper } from "./_components/lending-requests-list-wrapper";
import { BorrowedToolsListWrapper } from "./_components/borrowed-tools-list-wrapper";
import Link from "next/link";

interface RentalsPageProps {
  params: Promise<{
    type: "renting" | "lending";
    status: "requests" | "active" | "completed" | "rejected" | "incoming";
  }>;
}

type StatusConfig = {
  displayName: string;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
};

// Valid routes configuration
const validRoutes: Record<string, Record<string, StatusConfig>> = {
  renting: {
    requests: {
      displayName: "Requests",
      emptyMessage: "No pending requests.",
      emptyAction: { label: "Browse Tools", href: "/explore" },
    },
    active: {
      displayName: "Active",
      emptyMessage: "No active rentals.",
    },
    completed: {
      displayName: "Completed",
      emptyMessage: "No completed rentals.",
    },
    rejected: {
      displayName: "Rejected",
      emptyMessage: "No rejected requests.",
    },
  },
  lending: {
    incoming: {
      displayName: "Incoming",
      emptyMessage: "No incoming requests.",
    },
    active: {
      displayName: "Active",
      emptyMessage: "No active lending.",
    },
    completed: {
      displayName: "Completed",
      emptyMessage: "No completed lending.",
    },
    rejected: {
      displayName: "Rejected",
      emptyMessage: "No rejected requests.",
    },
  },
};

// Data fetching components
async function RentingRequestsData({
  status,
  statusConfig,
}: {
  status: "requests" | "rejected";
  statusConfig: StatusConfig;
}) {
  try {
    const rentalRequestsData = await rentalDAL.getRentalRequestsByStatus(
      status === "requests" ? "pending" : "rejected",
    );
    return (
      <RentingRequestsListWrapper
        data={rentalRequestsData}
        emptyStateMessage={statusConfig.emptyMessage}
        emptyStateAction={statusConfig.emptyAction}
      />
    );
  } catch (err) {
    const error =
      err instanceof Error ? err.message : "Failed to fetch rental requests";
    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    );
  }
}

async function BorrowedToolsData({
  status,
  statusConfig,
}: {
  status: "active" | "completed";
  statusConfig: StatusConfig;
}) {
  try {
    let borrowedToolsData: BorrowedTool[] = [];

    if (status === "active") {
      const borrowedData = await rentalDAL.getBorrowedTools();
      borrowedToolsData = borrowedData.currentRentals;
    } else {
      borrowedToolsData = await rentalDAL.getRentalsByStatus("completed");
    }

    return (
      <BorrowedToolsListWrapper
        data={borrowedToolsData}
        currentTab={status}
        emptyStateMessage={statusConfig.emptyMessage}
        emptyStateAction={statusConfig.emptyAction}
      />
    );
  } catch (err) {
    const error =
      err instanceof Error ? err.message : `Failed to fetch ${status} rentals`;
    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    );
  }
}

async function LendingRequestsData({
  status,
  statusConfig,
}: {
  status: "incoming" | "rejected" | "active" | "completed";
  statusConfig: StatusConfig;
}) {
  try {
    let lendingRequestsData: LendingRequestItem[] = [];

    if (status === "incoming") {
      lendingRequestsData =
        await rentalDAL.getLendingRequestsByStatus("pending");
    } else if (status === "rejected") {
      lendingRequestsData =
        await rentalDAL.getLendingRequestsByStatus("rejected");
    } else if (status === "active") {
      lendingRequestsData = await rentalDAL.getLendingRentalsByStatus("active");
    } else if (status === "completed") {
      lendingRequestsData =
        await rentalDAL.getLendingRentalsByStatus("completed");
    }

    return (
      <LendingRequestsListWrapper
        data={lendingRequestsData}
        emptyStateMessage={statusConfig.emptyMessage}
        emptyStateAction={statusConfig.emptyAction}
      />
    );
  } catch (err) {
    const error =
      err instanceof Error ? err.message : `Failed to fetch ${status} lending`;
    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    );
  }
}

// Loading fallback component
function DataLoadingFallback() {
  return (
    <div>
      <div className="mb-6 flex justify-between">
        <div className="bg-muted h-10 w-[448px] animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-[192px] animate-pulse rounded-lg" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-48 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default async function RentalsStatusPage({ params }: RentalsPageProps) {
  const { type, status } = await params;

  // Validate route parameters
  if (!validRoutes[type] || !validRoutes[type][status]) {
    notFound();
  }

  const typeConfig = validRoutes[type];
  const statusConfig = typeConfig[status];

  // Generate tab items
  const tabItems = Object.entries(typeConfig).map(([statusKey, config]) => {
    return {
      value: statusKey,
      label: config.displayName,
      href: `/dashboard/${type}/${statusKey}`,
    };
  });

  return (
    <div className="space-y-6">
      <Tabs value={status}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="mb-6 grid w-full min-w-max grid-cols-2 gap-1 sm:grid-cols-4">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link href={tab.href}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={status}>
          <Suspense fallback={<DataLoadingFallback />}>
            {type === "renting" &&
              (status === "requests" || status === "rejected") && (
                <RentingRequestsData
                  status={status}
                  statusConfig={statusConfig}
                />
              )}

            {type === "renting" &&
              (status === "active" || status === "completed") && (
                <BorrowedToolsData
                  status={status}
                  statusConfig={statusConfig}
                />
              )}

            {type === "lending" && (
              <LendingRequestsData
                status={
                  status as "incoming" | "rejected" | "active" | "completed"
                }
                statusConfig={statusConfig}
              />
            )}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
